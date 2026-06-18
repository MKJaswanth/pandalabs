export function PageHeader({ title, description, action }) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </div>
  )
}
