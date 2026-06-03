export function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-heading font-bold text-3xl text-primary-950 mb-4">About UniPlan</h1>
      <p className="text-gray-500 text-lg mb-8">
        The unified platform for university event management at Universidad Icesi.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {[
          { icon: '📅', title: 'Discover Events', desc: 'Browse workshops, talks, sports tournaments, volunteering opportunities, and more — all in one place.' },
          { icon: '✍️', title: 'Easy Registration', desc: 'One-click registration with automatic spot tracking and cancellation management.' },
          { icon: '📊', title: 'Smart Statistics', desc: 'Real-time occupancy tracking. Organizers get instant metrics on event engagement.' },
          { icon: '🏛️', title: 'Institutional Integration', desc: 'Connected to the university database. Validates student identity and academic prerequisites automatically.' },
          { icon: '🔒', title: 'Role-Based Access', desc: 'Students browse and register. Organizers create and manage events. Admins oversee the platform.' },
          { icon: '💬', title: 'Event Messaging', desc: 'Organizers can send updates and announcements directly to registered participants.' },
        ].map((feature) => (
          <div key={feature.title} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="text-2xl mb-2">{feature.icon}</div>
            <h3 className="font-heading font-medium text-primary-950 mb-1">{feature.title}</h3>
            <p className="text-sm text-gray-500">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-12">
        <h2 className="font-heading font-bold text-xl text-primary-950 mb-4">Technical Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-medium text-primary-700 mb-2">PostgreSQL</h3>
            <p className="text-gray-500">
              Stores relational data: events metadata, registrations, organizers, and statistics.
              Integrated with the institutional database for student and employee validation.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-primary-700 mb-2">MongoDB</h3>
            <p className="text-gray-500">
              Stores polymorphic event details using the Discriminator Pattern.
              Each event type (Workshop, Talk, Sports, Volunteering, Other) has its own schema with type-specific fields.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-primary-700 mb-2">Strategy Pattern</h3>
            <p className="text-gray-500">
              Registration validation adapts per event type — workshop prerequisites, volunteering hours, sports time conflicts.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-primary-700 mb-2">Observer Pattern</h3>
            <p className="text-gray-500">
              Statistics update asynchronously when students register or cancel, keeping the registration controller decoupled from analytics.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-gray-400 text-sm pb-8">
        <p className="mb-1">Universidad Icesi · SID II · 2026</p>
        <p>Built with TypeScript · React · Node.js · Express · Prisma · MongoDB</p>
      </div>
    </div>
  );
}
