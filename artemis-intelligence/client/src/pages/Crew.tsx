interface CrewMember {
  name: string
  role: string
  initials: string
  bio: string
  stats: string
  image: string
  imagePosition: string
}

const crew: CrewMember[] = [
  {
    name: 'Reid Wiseman',
    role: 'COMMANDER · NASA',
    initials: 'RW',
    bio: 'A Navy test pilot who spent 204 days aboard the ISS in 2014, Wiseman brings quiet authority to the mission. He commands with the kind of stillness that comes from having floated weightless watching Earth turn below him before. This time, he goes further.',
    stats: '2nd spaceflight · 204 days prior · ISS Expedition 41 CDR',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Reid%20Wiseman%20in%20a%20NASA%20news%20conference%20at%20the%20Kennedy%20Space%20Center%20in%20Florida%2C%20U.S.%20on%20August%208%2C%202023%20%28cropped%29.jpg',
    imagePosition: 'center 16%',
  },
  {
    name: 'Victor Glover',
    role: 'PILOT · NASA',
    initials: 'VG',
    bio: 'Glover made history on his first spaceflight — 167 days on the ISS as the first Black astronaut to serve on a long-duration mission. Now he pilots the first crewed vehicle to leave Earth orbit in half a century. The weight of that is not lost on him.',
    stats: '2nd spaceflight · 167 days prior · First person of color beyond LEO',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Victor%20Glover%20in%20a%20NASA%20news%20conference%20at%20the%20Kennedy%20Space%20Center%20in%20Florida%2C%20U.S.%20on%20August%208%2C%202023%20%28cropped%29.jpg',
    imagePosition: 'center 18%',
  },
  {
    name: 'Christina Koch',
    role: 'MISSION SPECIALIST · NASA',
    initials: 'CK',
    bio: "She holds the record for the longest single spaceflight by a woman — 328 days — and performed the first all-female spacewalk with Jessica Meir. Koch approaches deep space with a scientist's precision and an explorer's hunger.",
    stats: '2nd spaceflight · 328 days prior · World record EVA',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Christina%20Koch%20in%20a%20NASA%20news%20conference%20at%20the%20Kennedy%20Space%20Center%20in%20Florida%2C%20U.S.%20on%20August%208%2C%202023%20%28cropped%29.jpg',
    imagePosition: 'center 18%',
  },
  {
    name: 'Jeremy Hansen',
    role: 'MISSION SPECIALIST · CSA',
    initials: 'JH',
    bio: 'A former CF-18 fighter pilot and the first Canadian to venture beyond low Earth orbit, Hansen carries an entire nation\'s pride in a ship named Integrity. He has waited his career for this moment. By all accounts, he is ready.',
    stats: '1st spaceflight · 0 prior days · First non-US beyond LEO',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Jeremy%20Hansen%20in%20a%20NASA%20news%20conference%20at%20the%20Kennedy%20Space%20Center%20in%20Florida%2C%20U.S.%20on%20August%208%2C%202023%20%28cropped%29%202.jpg',
    imagePosition: 'center 20%',
  },
]

export default function Crew() {
  return (
    <div className="crew-page">
      <section className="crew-header">
        <span className="crew-ghost">CREW</span>
        <h1 className="crew-title">Artemis II</h1>
        <p className="crew-copy">Four astronauts. One historic journey. 10 days.</p>
      </section>

      <section className="crew-grid stagger">
        {crew.map((member) => (
          <article key={member.name} className="crew-card">
            <div className="crew-card-photo">
              <img
                src={member.image}
                alt={`${member.name} portrait`}
                className="crew-card-image"
                style={{ objectPosition: member.imagePosition }}
                loading="lazy"
              />
              <span className="crew-card-photo-meta">{member.role.split('·')[1]?.trim() ?? 'CREW'}</span>
              <span className="crew-card-initials">{member.initials}</span>
            </div>

            <div className="crew-card-body">
              <h2 className="crew-card-name">{member.name}</h2>
              <p className="crew-card-role">{member.role}</p>
              <div className="crew-card-divider" />
              <p className="crew-card-bio">{member.bio}</p>
              <p className="crew-card-stats">{member.stats}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
