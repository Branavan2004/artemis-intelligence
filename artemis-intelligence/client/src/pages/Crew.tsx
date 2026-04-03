export default function Crew() {
  const crew = [
    {
      name: 'Reid Wiseman',
      role: 'Commander',
      agency: 'NASA',
      record: 'Oldest person to leave low Earth orbit',
      bio: 'Navy test pilot and NASA astronaut. Previously served as Chief of the Astronaut Office. This is his second spaceflight.',
      missions: ['Expedition 40/41', 'Artemis II'],
      color: 'from-blue-600 to-blue-800',
      initials: 'RW',
    },
    {
      name: 'Victor Glover',
      role: 'Pilot',
      agency: 'NASA',
      record: 'First person of color beyond low Earth orbit',
      bio: 'Navy pilot and NASA astronaut. Previously flew to the ISS on Crew Dragon. Member of the first operational Crew Dragon mission.',
      missions: ['Crew-1 (ISS)', 'Artemis II'],
      color: 'from-purple-600 to-purple-800',
      initials: 'VG',
    },
    {
      name: 'Christina Koch',
      role: 'Mission Specialist',
      agency: 'NASA',
      record: 'First woman to travel to lunar vicinity',
      bio: 'Electrical engineer and NASA astronaut. Holds the record for longest single spaceflight by a woman — 328 days on the ISS.',
      missions: ['Expedition 59/60/61', 'Artemis II'],
      color: 'from-pink-600 to-pink-800',
      initials: 'CK',
    },
    {
      name: 'Jeremy Hansen',
      role: 'Mission Specialist',
      agency: 'CSA',
      record: 'First non-American to travel to lunar vicinity',
      bio: 'Canadian Space Agency astronaut and former CF-18 pilot. This is his first spaceflight, making him the first Canadian to travel beyond low Earth orbit.',
      missions: ['Artemis II'],
      color: 'from-red-600 to-red-800',
      initials: 'JH',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-black text-white mb-2">CREW</h1>
        <p className="text-gray-400">Meet the four astronauts making history on Artemis II</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {crew.map((member) => (
          <div key={member.name} className="bg-space-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition-all">
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center flex-shrink-0`}>
                <span className="font-display font-bold text-white text-lg">{member.initials}</span>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-white">{member.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-artemis-blue text-sm font-medium">{member.role}</span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-400 text-sm">{member.agency}</span>
                </div>
              </div>
            </div>

            <div className="bg-artemis-blue/10 border border-artemis-blue/20 rounded-lg px-3 py-2 mb-4">
              <span className="text-artemis-blue text-xs font-mono">🏆 RECORD: </span>
              <span className="text-white text-sm">{member.record}</span>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mb-4">{member.bio}</p>

            <div>
              <div className="text-gray-500 text-xs font-mono uppercase mb-2">Missions</div>
              <div className="flex flex-wrap gap-2">
                {member.missions.map((m) => (
                  <span key={m} className={`text-xs px-2 py-1 rounded-full ${m === 'Artemis II' ? 'bg-artemis-blue/20 text-artemis-blue border border-artemis-blue/30' : 'bg-gray-800 text-gray-400'}`}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
