import PageHeader from './PageHeader'

export default function ModuleGateCard({ icon, iconTone, title, subtitle, children }) {
  return (
    <section className="section py-4">
      <div className="container app-page-container">
        <div className="box module-gate-card">
          <PageHeader icon={icon} iconTone={iconTone} title={title} subtitle={subtitle} />
          {children}
        </div>
      </div>
    </section>
  )
}
