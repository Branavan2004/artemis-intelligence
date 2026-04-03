import { motion } from 'framer-motion'

const crew = [
  {
    name: 'Reid Wiseman',
    role: 'Commander',
    agency: 'NASA',
    record: 'Oldest person to leave low Earth orbit',
    bio: 'Navy test pilot and NASA astronaut. Previously served as Chief of the Astronaut Office. This is his second spaceflight.',
    missions: ['Expedition 40/41', 'Artemis II'],
    borderClass: 'border-l-blue-600',
    avatarClass: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    initials: 'RW',
  },
  {
    name: 'Victor Glover',
    role: 'Pilot',
    agency: 'NASA',
    record: 'First person of color beyond low Earth orbit',
    bio: 'Navy pilot and NASA astronaut. Previously flew to the ISS on Crew Dragon. Member of the first operational Crew Dragon mission.',
    missions: ['Crew-1 (ISS)', 'Artemis II'],
    borderClass: 'border-l-emerald-500',
    avatarClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    initials: 'VG',
  },
  {
    name: 'Christina Koch',
    role: 'Mission Specialist',
    agency: 'NASA',
    record: 'First woman to travel to lunar vicinity',
    bio: 'Electrical engineer and NASA astronaut. Holds the record for the longest single spaceflight by a woman, after spending 328 days on the International Space Station.',
    missions: ['Expedition 59/60/61', 'Artemis II'],
    borderClass: 'border-l-amber-500',
    avatarClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    initials: 'CK',
  },
  {
    name: 'Jeremy Hansen',
    role: 'Mission Specialist',
    agency: 'CSA',
    record: 'First non-American to travel to lunar vicinity',
    bio: 'Canadian Space Agency astronaut and former CF-18 pilot. This is his first spaceflight and the first time a Canadian astronaut is heading beyond low Earth orbit.',
    missions: ['Artemis II'],
    borderClass: 'border-l-amber-500',
    avatarClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    initials: 'JH',
  },
]

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

export default function Crew() {
  return (
    <div className="page">
      <motion.section initial="hidden" animate="show" variants={fadeIn} className="page-header-split">
        <div className="page-header">
          <p className="section-label">Crew</p>
          <h1 className="page-title">Crew profiles</h1>
          <p className="page-copy">
            The four Artemis II astronauts, their mission roles, and the milestones each one brings to the flight.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Crew size', '4'],
            ['Agencies', '2'],
            ['Historic firsts', '3+'],
          ].map(([label, value]) => (
            <div key={label} className="card-plain p-6">
              <p className="section-label">{label}</p>
              <div className="value-display mt-4">{value}</div>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section initial="hidden" animate="show" variants={fadeIn} className="grid gap-6 md:grid-cols-2">
        {crew.map((member) => (
          <article key={member.name} className={`card-plain border-l-4 p-6 ${member.borderClass}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${member.avatarClass}`}>
                  {member.initials}
                </div>

                <div>
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--text)]">{member.name}</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {member.role} · {member.agency}
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted)]">
                {member.agency}
              </span>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="eyebrow">Background</p>
                <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{member.bio}</p>
              </div>

              <div className="card-muted p-4">
                <p className="eyebrow">Record</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text)]">{member.record}</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[color:var(--border)]">
              <p className="eyebrow">Mission history</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {member.missions.map((mission) => (
                  <span
                    key={mission}
                    className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted)]"
                  >
                    {mission}
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </motion.section>
    </div>
  )
}
