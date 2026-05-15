export const PLAYERS = [
  {
    id:      'boulou',
    name:    'Boulou',
    role:    'Top',
    emoji:   '👍',
    roleEmoji: '⚔️',
    color:   '#f97316',
    colorRgb:'249,115,22',
    docId:   'perf-boulou',
    opgg:    '',
    cats: [
      { label:'🌾 Laning', color:'#f97316', items:[
        {id:'farming',  l:'Farming',                                      h:'Régularité du CS, gestion des last hits sous pression'},
        {id:'trading',  l:'Trading (spacing, kiting, gestion des CDs)',   h:'Efficacité des échanges, jeu en dehors des CDs adverses, kiting en fight'},
        {id:'wavemgt',  l:'Wave management',                              h:'Freeze, slow push, reset — synchronisation avec le jungler'},
      ]},
      { label:'⚔️ Combat & Présence', color:'#ef4444', items:[
        {id:'sums',      l:'Gestion des summoners',                       h:'Timing TP offensif/défensif, flash, ignite — lecture des sums adverses'},
        {id:'matchup',   l:'Compréhension et adaptation aux matchups',    h:'Lire ce qui est fort ou faible, jouer autour de ses spikes'},
        {id:'teamfight', l:'Rôle en teamfight (flanc, front, peel)',      h:'Placement à l\'engage, absorption des dégâts, protection des carries'},
        {id:'split',     l:'Rôle en splitpush',                           h:'Création de pression, timing du 1v1, savoir quand rejoindre'},
      ]},
      { label:'🗺️ Macro & Carte', color:'#f59e0b', items:[
        {id:'rotation',  l:'Rotation et placement macro',                 h:'Timing des rotations vers objectifs, rejoindre sans perdre de wave'},
        {id:'vision',    l:'Vision',                                      h:'Wards en river top, contrôle de la tri-brush, exploitation de l\'info'},
      ]},
      { label:'🤝 Collectif', color:'#06b6d4', items:[
        {id:'comms',     l:'Communication',                               h:'Appels sur le jungler adverse, calls split, informations partagées'},
      ]},
      { label:'🧠 Mental & Adaptabilité', color:'#a855f7', items:[
        {id:'pool',      l:'Polyvalence et champion pool',                h:'Tanks, carries, splitpushers — flexibilité selon la draft'},
        {id:'mental',    l:'Mental et gestion du tilt',                  h:'Stabilité après une défaite de lane, réaction aux erreurs, consistance'},
      ]},
    ],
  },
  {
    id:      'zugu',
    name:    'Zugu',
    role:    'Jungle',
    emoji:   '🕊️',
    roleEmoji: '🌿',
    color:   '#22c55e',
    colorRgb:'34,197,94',
    docId:   'perf-zugu',
    opgg:    '',
    cats: [
      { label:'🌿 Clear & Mécanique Jungle', color:'#22c55e', items:[
        {id:'pathing',  l:'Pathing jungle',      h:'Cohérence du clear dans le sens du jeu, pas de camp gaspillé'},
        {id:'clearspd', l:'Clear speed',         h:'Efficacité du farming de camps, perte minimale de HP'},
        {id:'smite',    l:'Précision de smite',  h:'Objectifs sécurisés au smite — un smite raté peut coûter la game'},
      ]},
      { label:'⚡ Impact sur la carte', color:'#f59e0b', items:[
        {id:'gank',     l:'Qualité de gank',     h:'Angle, timing, lecture de la wave — gank qui crée un avantage réel'},
        {id:'tracking', l:'Jungle tracking',     h:'Estimation de la position adverse partagée en temps réel'},
        {id:'tempo',    l:'Tempo',               h:'Être au bon endroit au bon moment, savoir quoi faire ensuite'},
        {id:'invade',   l:'Invade',              h:'Décision de rentrer en jungle adverse, timing et couverture correcte'},
      ]},
      { label:'🗺️ Lecture & Adaptabilité', color:'#06b6d4', items:[
        {id:'proactive',l:'Proactivité quand on domine',        h:'Convertir un avantage — objectifs, pression, snowball'},
        {id:'reactive', l:'Réactivité quand on est derrière',  h:'Crossmap moves, reset, contre-play pour revenir dans la game'},
        {id:'vision',   l:'Vision',                            h:'Setup vision avant objectifs, déni de vision jungler adverse'},
      ]},
      { label:'🤝 Collectif & Combat', color:'#a855f7', items:[
        {id:'comms',    l:'Communication',  h:'Appels clairs sur le jungler adverse, calls objectifs, infos utiles'},
        {id:'teamfight',l:'Teamfight',      h:'Positionnement, priorité de cibles, engage ou peel selon le rôle'},
      ]},
      { label:'🧠 Mental', color:'#ec4899', items:[
        {id:'mental',   l:'Mental et gestion du tilt', h:'Stabilité après erreur de smite ou gank raté, réaction sereine'},
      ]},
    ],
  },
  {
    id:      'lakrael',
    name:    'Lakraël',
    role:    'Mid',
    emoji:   '👀',
    roleEmoji: '✨',
    color:   '#3b82f6',
    colorRgb:'59,130,246',
    docId:   'perf-lakrael',
    opgg:    '',
    cats: [
      { label:'🌾 Laning', color:'#3b82f6', items:[
        {id:'farming',  l:'Farming',                                       h:'Régularité du CS, gestion des last hits sous pression et en roam'},
        {id:'trading',  l:'Trading (spacing, kiting, gestion des CDs)',    h:'Efficacité des échanges, jeu en dehors des CDs adverses, kiting en fight'},
        {id:'wavemgt',  l:'Wave management',                               h:'Freeze, slow push, reset — synchronisation avec les roams et le jungler'},
      ]},
      { label:'⚔️ Mécanique & Combat', color:'#6366f1', items:[
        {id:'pos',      l:'Positionnement en teamfight',                   h:'Distance correcte, angle propre, pas de feed AoE ou burst ennemi'},
        {id:'sums',     l:'Gestion des summoners',                         h:'Timing flash, ignite, teleport — lecture des sums adverses en mid'},
        {id:'dps',      l:'Efficacité du DPS (DPS / mort)',                h:'Output de dégâts par rapport au nombre de mort'},
      ]},
      { label:'🗺️ Roaming & Influence carte', color:'#06b6d4', items:[
        {id:'roam',     l:'Roaming (timing, setup de wave, impact)',       h:'Wave push avant de roam, bon angle, kill ou assist obtenu'},
        {id:'rotation', l:'Rotation et placement macro',                   h:'Rejoindre les combats, timing des mouvements post-lane'},
        {id:'vision',   l:'Vision',                                        h:'Wards river mid, flancs, preparation des objectifs'},
        {id:'lecture',  l:'Lecture des menaces',                           h:'Anticiper les dives, engages, fenêtres dangereuses pour la team'},
        {id:'tracking', l:'Tracking jungler',                              h:'Estimation de la position du jungler adverse partagée à l\'équipe'},
      ]},
      { label:'🤝 Collectif', color:'#a855f7', items:[
        {id:'comms',    l:'Communication',                                 h:'Appels sur le jungler adverse, calls de roam, infos utiles en temps réel'},
      ]},
      { label:'🧠 Mental & Adaptabilité', color:'#ec4899', items:[
        {id:'pool',     l:'Adaptabilité et champion pool',                 h:'AP, AD, flex picks — réponse aux demandes de draft selon le contexte'},
        {id:'mental',   l:'Mental et gestion du tilt',                    h:'Stabilité quand la lane est perdue, réaction aux erreurs, consistance'},
      ]},
    ],
  },
  {
    id:      'ke1do',
    name:    'Ke1do',
    role:    'ADC',
    emoji:   '🐯',
    roleEmoji: '🎯',
    color:   '#ef4444',
    colorRgb:'239,68,68',
    docId:   'perf-ke1do',
    opgg:    '',
    cats: [
      { label:'🌾 Laning', color:'#ef4444', items:[
        {id:'farming',  l:'Farming',                              h:'Régularité du CS, gestion du dernier coup'},
        {id:'trading',  l:'Trading en lane',                      h:'Efficacité des échanges, timing des trades'},
        {id:'wavemgt',  l:'Wave management',                      h:'Freeze, slow push, reset — lecture de la wave'},
      ]},
      { label:'⚔️ Combat & Mécanique', color:'#f97316', items:[
        {id:'pos',      l:'Positionnement',                       h:'Distance de sécurité, angles en teamfight'},
        {id:'kiting',   l:'Kiting et déplacement',               h:'Attaque en mouvement, animation cancel, micro'},
        {id:'dps',      l:'Efficacité du DPS (DPS / mort)',       h:'Output de dégâts rapporté au nombre de morts'},
        {id:'sums',     l:'Gestion des summoners',                h:'Timing flash/ignite/heal — lecture des sums adverses'},
      ]},
      { label:'🗺️ Macro & Carte', color:'#f59e0b', items:[
        {id:'rotation', l:'Rotation et placement macro',          h:'Rejoindre les combats, timing des mouvements'},
        {id:'lecture',  l:'Lecture et adaptation aux menaces',    h:'Anticiper les dives, engages, junglers adverses'},
        {id:'vision',   l:'Vision',                              h:'Wards placées en bot, exploitation des informations'},
      ]},
      { label:'🤝 Collectif', color:'#06b6d4', items:[
        {id:'syncsup',  l:'Synergie et communication support',    h:'Coordination des trades et objectifs bot lane'},
        {id:'comms',    l:'Communication',                        h:'Qualité et clarté des appels en jeu'},
      ]},
      { label:'🧠 Mental & Adaptabilité', color:'#a855f7', items:[
        {id:'pool',     l:'Polyvalence et champion pool',         h:'Nombre de picks maîtrisés, flexibilité en draft'},
        {id:'mental',   l:'Mental et gestion du tilt',           h:'Stabilité, réaction aux erreurs, consistance'},
      ]},
    ],
  },
  {
    id:      'joordy',
    name:    'Joordy',
    role:    'Support',
    emoji:   '🥀',
    roleEmoji: '🌺',
    color:   '#a855f7',
    colorRgb:'168,85,247',
    docId:   'perf-joordy',
    opgg:    '',
    cats: [
      { label:'🌺 Laning', color:'#a855f7', items:[
        {id:'gestion_lane',l:'Gestion de lane',  h:'Pression, trades, gestion de la priorité — sans sacrifier l\'ADC'},
        {id:'vision',      l:'Vision',           h:'Wards offensives/défensives, déwarding, exploitation des informations'},
      ]},
      { label:'⚡ Combat', color:'#ec4899', items:[
        {id:'engage',      l:'Engage',           h:'Qualité des initiations, timing, angle — surprise ou fiabilité'},
        {id:'peeling',     l:'Peeling',          h:'Protection de l\'ADC et des carries — interception, disruption, heal/shield'},
      ]},
      { label:'🗺️ Macro', color:'#f59e0b', items:[
        {id:'roaming',     l:'Roaming',          h:'Timing des déplacements, impact des roams, lanes laissées saines'},
        {id:'placement',   l:'Placement macro',  h:'Position sur la carte selon la phase de jeu et les objectifs à venir'},
      ]},
      { label:'🤝 Collectif', color:'#06b6d4', items:[
        {id:'comms',       l:'Communication',    h:'Clarté des appels, shot-calling, synergie avec l\'ADC et le reste de l\'équipe'},
      ]},
      { label:'🧠 Mental', color:'#8b5cf6', items:[
        {id:'adaptabilite',l:'Adaptabilité',     h:'Flexibilité du champion pool — engage, enchanteresse, poke — selon le draft'},
        {id:'mental',      l:'Mental',           h:'Stabilité, réaction aux erreurs, consistance sous pression'},
      ]},
    ],
  },
]

export const ROLE_SLUGS = {
  top:     'boulou',
  jungle:  'zugu',
  mid:     'lakrael',
  adc:     'ke1do',
  support: 'joordy',
}

export function getPlayerByRole(role) {
  const id = ROLE_SLUGS[role?.toLowerCase()]
  return PLAYERS.find(p => p.id === id) || null
}

export const QLABELS = ['—','Très insuffisant','Insuffisant','Insuffisant','Passable','Moyen','Correct','Bon','Très bon','Excellent','Exceptionnel']
