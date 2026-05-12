import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { logger, friendlyError } from '../lib/logger'
import { logAudit } from '../lib/audit'
import { dispatchNotification } from '../lib/notifications'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

const REACTION_EMOJIS = ['heart', 'thumbsup', 'lightbulb', 'question', 'celebrate']

export function usePosts() {
  const { user } = useAuth()
  const { project } = useProject()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const projectId = project?.id

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (!projectId) return
    if (isInitial) setLoading(true)

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, full_name, avatar_url),
        comments(count),
        post_likes(profile_id),
        post_follows(profile_id),
        post_reactions(id, emoji, profile_id),
        poll_options(id, text, sort_order, poll_votes(id, profile_id))
      `)
      .eq('project_id', projectId)
      .eq('is_hidden', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('usePosts.fetch', error)
    } else {
      const transformed = (data || []).map(p => {
        // Aggregate reactions by emoji
        const reactionCounts = {}
        const myReactions = new Set()
        ;(p.post_reactions || []).forEach(r => {
          reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1
          if (r.profile_id === user?.id) myReactions.add(r.emoji)
        })

        // Poll data
        const pollOptions = (p.poll_options || [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(o => ({
            ...o,
            vote_count: o.poll_votes?.length || 0,
            my_vote: o.poll_votes?.some(v => v.profile_id === user?.id) || false,
          }))
        const totalVotes = pollOptions.reduce((sum, o) => sum + o.vote_count, 0)

        return {
          ...p,
          comment_count: p.comments?.[0]?.count || 0,
          like_count: p.post_likes?.length || 0,
          is_liked: p.post_likes?.some(l => l.profile_id === user?.id) || false,
          is_followed: p.post_follows?.some(f => f.profile_id === user?.id) || false,
          reactions: reactionCounts,
          myReactions,
          totalReactions: Object.values(reactionCounts).reduce((s, c) => s + c, 0),
          pollOptions,
          totalVotes,
          hasVoted: pollOptions.some(o => o.my_vote),
        }
      })
      setPosts(transformed)
    }
    setLoading(false)
  }, [projectId, user?.id])

  useEffect(() => { fetchPosts(true) }, [fetchPosts])

  // Realtime — debounce rapid changes (comments, likes, reactions) to avoid N+1 refetches
  const debounceRef = useRef(null)
  useEffect(() => {
    if (!projectId) return
    const debouncedFetch = () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchPosts(), 500)
    }
    const channel = supabase
      .channel(`posts:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `project_id=eq.${projectId}` }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, debouncedFetch)
      .subscribe()
    return () => { supabase.removeChannel(channel); clearTimeout(debounceRef.current) }
  }, [projectId, fetchPosts])

  async function createPost({ text, tag, audience, image_url, post_type, poll_options }) {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        project_id: projectId,
        author_id: user.id,
        text,
        tag: tag || null,
        audience: audience || 'members',
        image_url: image_url || null,
        post_type: post_type || 'post',
      })
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .single()
    if (error) { logger.error('usePosts.createPost', error); throw new Error(friendlyError(error)) }

    // Create poll options if poll
    if (post_type === 'poll' && poll_options?.length > 0) {
      const { error: pollError } = await supabase.from('poll_options').insert(
        poll_options.map((text, i) => ({ post_id: data.id, text, sort_order: i }))
      )
      if (pollError) {
        logger.error('usePosts.createPost.pollOptions', pollError)
        throw new Error(friendlyError(pollError))
      }
    }

    // Auto-follow own posts (best-effort, don't throw)
    try {
      await supabase.from('post_follows').upsert({ profile_id: user.id, post_id: data.id }, { onConflict: 'profile_id,post_id' })
    } catch (e) { /* ignore */ }
    logAudit('post.created', 'post', { resourceId: data.id, projectId, metadata: { post_type: post_type || 'post' } })
    if (data?.id) dispatchNotification({ projectId, type: 'new_post', referenceId: data.id, actorId: user.id })
    fetchPosts()
    return data
  }

  async function toggleLike(postId) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const wasLiked = post.is_liked

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId
      ? { ...p, is_liked: !wasLiked, like_count: p.like_count + (wasLiked ? -1 : 1) }
      : p))

    // Server — rollback on error
    const { error } = wasLiked
      ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('profile_id', user.id)
      : await supabase.from('post_likes').insert({ post_id: postId, profile_id: user.id })

    if (error) {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, is_liked: wasLiked, like_count: p.like_count + (wasLiked ? 1 : -1) }
        : p))
      logger.error('usePosts.toggleLike', error)
    }
  }

  async function toggleReaction(postId, emoji) {
    const post = posts.find(p => p.id === postId)
    if (!post) return

    const hadReaction = post.myReactions.has(emoji)

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const newReactions = { ...p.reactions }
      const newMyReactions = new Set(p.myReactions)
      if (hadReaction) {
        newReactions[emoji] = Math.max(0, (newReactions[emoji] || 1) - 1)
        if (newReactions[emoji] === 0) delete newReactions[emoji]
        newMyReactions.delete(emoji)
      } else {
        newReactions[emoji] = (newReactions[emoji] || 0) + 1
        newMyReactions.add(emoji)
      }
      return {
        ...p,
        reactions: newReactions,
        myReactions: newMyReactions,
        totalReactions: Object.values(newReactions).reduce((s, c) => s + c, 0),
      }
    }))

    // Server update — rollback on error
    const { error } = hadReaction
      ? await supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', user.id).eq('emoji', emoji)
      : await supabase.from('post_reactions').insert({ post_id: postId, profile_id: user.id, emoji })

    if (error) {
      // Revert the optimistic update
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        const revReactions = { ...p.reactions }
        const revMyReactions = new Set(p.myReactions)
        if (hadReaction) {
          revReactions[emoji] = (revReactions[emoji] || 0) + 1
          revMyReactions.add(emoji)
        } else {
          revReactions[emoji] = Math.max(0, (revReactions[emoji] || 1) - 1)
          if (revReactions[emoji] === 0) delete revReactions[emoji]
          revMyReactions.delete(emoji)
        }
        return { ...p, reactions: revReactions, myReactions: revMyReactions, totalReactions: Object.values(revReactions).reduce((s, c) => s + c, 0) }
      }))
      logger.error('usePosts.toggleReaction', error)
    }
  }

  async function toggleFollow(postId) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const wasFollowed = post.is_followed

    // Optimistic
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_followed: !wasFollowed } : p))

    const { error } = wasFollowed
      ? await supabase.from('post_follows').delete().eq('post_id', postId).eq('profile_id', user.id)
      : await supabase.from('post_follows').insert({ post_id: postId, profile_id: user.id })

    if (error) {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_followed: wasFollowed } : p))
      logger.error('usePosts.toggleFollow', error)
    }
  }

  async function votePoll(optionId) {
    // Remove existing vote first (one vote per poll)
    const post = posts.find(p => p.pollOptions?.some(o => o.id === optionId))
    if (!post) return

    // Remove old votes for this poll
    const allOptionIds = post.pollOptions.map(o => o.id)
    await supabase.from('poll_votes').delete().in('option_id', allOptionIds).eq('profile_id', user.id)
    // Add new vote
    await supabase.from('poll_votes').insert({ option_id: optionId, profile_id: user.id })
    fetchPosts()
  }

  async function togglePin(postId) {
    const post = posts.find(p => p.id === postId)
    if (!post) return
    await supabase.from('posts').update({ is_pinned: !post.is_pinned }).eq('id', postId)
    fetchPosts()
  }

  async function deletePost(postId) {
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) {
      logger.error('usePosts.deletePost', error)
      throw new Error(friendlyError(error))
    }
    logAudit('post.deleted', 'post', { resourceId: postId, projectId })
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  async function updatePost(postId, updates) {
    const { error } = await supabase.from('posts').update(updates).eq('id', postId)
    if (error) { logger.error('usePosts.updatePost', error); throw new Error(friendlyError(error)) }
    fetchPosts()
  }

  return { posts, loading, createPost, toggleLike, toggleReaction, toggleFollow, votePoll, togglePin, deletePost, updatePost, refetch: fetchPosts }
}

export function useComments(postId) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchComments = useCallback(async () => {
    if (!postId) return
    const { data, error } = await supabase
      .from('comments')
      .select('*, author:profiles(id, full_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) logger.error('useComments.fetch', error)
    else setComments(data || [])
    setLoading(false)
  }, [postId])

  useEffect(() => { fetchComments() }, [fetchComments])

  async function addComment(text, replyToId, replyToName) {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        text,
        reply_to_id: replyToId || null,
        reply_to_name: replyToName || null,
      })
      .select('*, author:profiles(id, full_name, avatar_url), post:posts(project_id)')
      .single()
    if (error) { logger.error('useComments.addComment', error); throw new Error(friendlyError(error)) }
    setComments(prev => [...prev, data])
    const projectId = data?.post?.project_id
    if (data?.id && projectId) {
      // Reply op andermans comment → notify die persoon. Anders: notify followers van de post.
      const type = replyToId ? 'new_reply' : 'new_comment'
      dispatchNotification({ projectId, type, referenceId: data.id, actorId: user.id })
    }
    return data
  }

  return { comments, loading, addComment, refetch: fetchComments }
}

// Re-export for backward compat
export { uploadImage as uploadPostImage } from '../lib/storage'
