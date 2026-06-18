import { fileIcon, fileIconColor, formatFileSize } from '../lib/constants'
import { openProjectFile } from '../lib/storage'

export default function FileRow({ file }) {
  const icon = fileIcon(file.file_type)
  const color = fileIconColor(file.file_type)

  return (
    <a
      className="file-row"
      href={file.file_path}
      onClick={(e) => { e.preventDefault(); openProjectFile(file.file_path) }}
      target="_blank"
      rel="noopener noreferrer"
    >
      <i className={`file-row__icon ${icon}`} style={{ color }} />
      <span className="file-row__name">{file.file_name}</span>
      {file.file_size > 0 && (
        <span className="file-row__size">{formatFileSize(file.file_size)}</span>
      )}
      <i className="fa-solid fa-download file-row__download" />
    </a>
  )
}
