<template>
  <div class="db-layout">
    <LoadingScreen :visible="loading" label="PlaZma" color="var(--purple)" />

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="sb-logo">
        <div class="sb-badge">PZ</div>
        <div><div class="sb-name">PlaZma</div><div class="sb-sub">Esport · LoL</div></div>
      </div>
      <nav class="sb-nav">
        <div class="nav-a active" @click="scrollTo('s-kpi')"><span class="nav-ic">📊</span>Dashboard</div>
        <div class="nav-sep">Sections</div>
        <div class="nav-a" @click="scrollTo('s-roster')"><span class="nav-ic">👥</span>Roster<span class="nav-badge">5</span></div>
        <div class="nav-a" @click="scrollTo('s-elo')"><span class="nav-ic">📈</span>ELO Équipe</div>
        <div class="nav-a" @click="scrollTo('s-scrims')"><span class="nav-ic">👍</span>Scrims<span class="nav-badge">{{ state.matches.length }}</span></div>
        <div class="nav-a" @click="scrollTo('s-obj')"><span class="nav-ic">🎯</span>Objectifs<span class="nav-badge">{{ openObjCount }}</span></div>
        <div class="nav-sep">Navigation</div>
        <RouterLink to="/scrim" class="nav-a"><span class="nav-ic">🔬</span>CR Scrim</RouterLink>
        <RouterLink to="/scouting" class="nav-a"><span class="nav-ic">🔍</span>Scouting</RouterLink>
        <RouterLink to="/schedule" class="nav-a"><span class="nav-ic">📅</span>Planning</RouterLink>
        <RouterLink to="/satisfaction" class="nav-a"><span class="nav-ic">💬</span>Satisfaction</RouterLink>
        <RouterLink to="/organisation" class="nav-a"><span class="nav-ic">🗂️</span>Organisation</RouterLink>
        <RouterLink to="/draft" class="nav-a"><span class="nav-ic">🗺️</span>Draft</RouterLink>
        <div class="nav-a" @click="scrollTo('s-params')"><span class="nav-ic">⚙️</span>Paramètres</div>
        <RouterLink to="/" class="nav-a" style="margin-top:8px"><span class="nav-ic">🏠</span>Hub PlaZma</RouterLink>
      </nav>
      <div class="sb-foot">
        <div class="sync-row">
          <div class="sync-dot" :class="syncState"></div>
          <span class="sync-txt" :style="{ color: syncStateColor }">{{ syncText }}</span>
          <span class="sync-t">{{ syncTime }}</span>
        </div>
        <button class="btn-save" :class="{ saved: flashOk === true }" @click="save">💾 Sauvegarder</button>
        <div class="btn-row">
          <div class="btn-mini" @click="exportBackup">📦 Backup</div>
          <div class="btn-mini" @click="importBackup">📥 Import</div>
          <div class="btn-mini red" @click="resetData">🗑 Reset</div>
        </div>
      </div>
    </aside>

    <!-- MAIN -->
    <main class="main">
      <RouterLink to="/" class="hub-link">← Hub PlaZma</RouterLink>

      <div class="topbar">
        <div>
          <div class="pg-title">Dashboard</div>
          <div class="pg-sub">{{ weekLabel }}</div>
        </div>
        <div class="topbar-right">
          <div class="date-chip">{{ todayLabel }}</div>
          <button class="btn btn-primary" @click="openAddMatch">＋ Ajouter un match</button>
        </div>
      </div>

      <!-- KPIs -->
      <section id="s-kpi">
        <div class="kpi-strip">
          <div class="kpi kpi-wr">
            <div class="kpi-glow" :style="{ background: wr !== null && wr >= 50 ? 'var(--green)' : 'var(--red)' }"></div>
            <div class="kpi-label">Win Rate global</div>
            <div class="kpi-val" :style="{ color: wr !== null && wr >= 50 ? 'var(--green)' : 'var(--red)' }">{{ wr !== null ? wr + '%' : '—' }}</div>
            <div class="kpi-sub"><b>{{ wins }}V</b> — <b>{{ losses }}D</b> · {{ total }} match{{ total > 1 ? 's' : '' }}</div>
          </div>
          <div class="kpi kpi-scrims">
            <div class="kpi-glow" style="background:var(--orange)"></div>
            <div class="kpi-label">Scrims cette semaine</div>
            <div class="kpi-val" style="font-size:32px" :style="{ color: weekWins > weekLosses ? 'var(--green)' : weekLosses > weekWins ? 'var(--red)' : 'var(--tx2)' }">{{ weekMatches.length > 0 ? weekWins + 'V ' + weekLosses + 'D' : '—' }}</div>
            <div class="kpi-sub">{{ weekMatches.length }} scrim{{ weekMatches.length > 1 ? 's' : '' }} joué{{ weekMatches.length > 1 ? 's' : '' }}</div>
          </div>
          <div class="kpi kpi-elo">
            <div class="kpi-glow" :style="{ background: eloTierColor }"></div>
            <div class="kpi-label">ELO Équipe</div>
            <div class="kpi-val" :style="{ color: eloTierColor }">{{ state.teamElo }}</div>
            <div class="kpi-sub"><b :style="{ color: eloTierColor }">{{ eloTierLabel }}</b></div>
          </div>
          <div class="kpi kpi-streak">
            <div class="kpi-glow" style="background:var(--yellow)"></div>
            <div class="kpi-label">Série en cours</div>
            <div class="kpi-val"><span class="delta" :class="streakClass">{{ streakText }}</span></div>
            <div class="kpi-sub">Dernière forme</div>
          </div>
          <div class="kpi kpi-month">
            <div class="kpi-glow" style="background:var(--cyan)"></div>
            <div class="kpi-label">Scrims ce mois</div>
            <div class="kpi-val" style="color:var(--cyan)">{{ monthMatches }}</div>
            <div class="kpi-sub">{{ monthOfficial }} officiel{{ monthOfficial > 1 ? 's' : '' }}</div>
          </div>
          <div class="kpi kpi-event">
            <div class="kpi-glow" style="background:var(--pink)"></div>
            <div class="kpi-label">Prochain événement</div>
            <div class="kpi-val" :style="{ fontSize: (state.nextEvent?.length > 12 ? '16px' : '22px'), color: 'var(--pink)', lineHeight: '1.15', marginBottom: '8px' }">{{ state.nextEvent || 'Non configuré' }}</div>
            <div class="kpi-sub" v-if="state.nextEventDate">📅 {{ formatEventDate }} · <b>J-{{ daysLeft }}</b></div>
          </div>
        </div>
      </section>

      <!-- ROSTER -->
      <section class="sec" id="s-roster">
        <div class="sec-head">
          <div class="sec-title"><div class="sec-dot" style="background:var(--cyan)"></div>Roster — Rangs SoloQ EUW</div>
          <button class="sec-action" @click="saveRoster">✓ Enregistrer les rangs</button>
        </div>
        <div class="roster-grid">
          <div v-for="p in state.roster" :key="p.id" class="pcard">
            <div class="pc-strip" :style="{ background: p.color }"></div>
            <div class="pc-head">
              <div class="pc-emo">{{ p.emoji }}</div>
              <div>
                <div class="pc-name">{{ p.name }}</div>
                <div class="pc-role" :style="{ color: p.color }">{{ p.role }}</div>
              </div>
            </div>
            <div class="pc-body">
              <div>
                <div class="pc-lbl">Rang SoloQ</div>
                <select class="pc-sel" v-model="p.tier">
                  <option v-for="(t, k) in TIER" :key="k" :value="k">{{ t.fr }}</option>
                </select>
              </div>
              <div class="pc-row">
                <div style="flex:1"><div class="pc-lbl">Div.</div>
                  <select class="pc-sel" v-model="p.rank">
                    <option value="">-</option>
                    <option v-for="r in ['IV','III','II','I']" :key="r" :value="r">{{ r }}</option>
                  </select>
                </div>
                <div style="flex:1"><div class="pc-lbl">LP</div><input class="pc-inp" type="number" min="0" max="100" v-model.number="p.lp" placeholder="0"></div>
                <div style="flex:1"><div class="pc-lbl">WR%</div><input class="pc-inp" type="number" min="0" max="100" v-model.number="p.wr" placeholder="—"></div>
              </div>
              <div style="padding-top:4px;border-top:1px solid var(--bd)">
                <div class="pc-rank-display" :style="{ color: TIER[p.tier]?.color || '#9ca3af' }">{{ TIER[p.tier]?.fr }}{{ p.rank ? ' ' + p.rank : '' }}</div>
                <div class="pc-lp">{{ p.lp || 0 }} LP<span v-if="p.wr"> · <span :style="{ color: p.wr >= 55 ? 'var(--green)' : p.wr >= 50 ? 'var(--yellow)' : 'var(--red)', fontWeight: 700 }">{{ p.wr }}% WR</span></span></div>
              </div>
              <a v-if="p.opgg" class="btn-opgg" :href="`https://www.op.gg/summoners/euw/${encodeURIComponent(p.opgg)}`" target="_blank">🔗 Voir sur op.gg</a>
              <button v-else class="btn-opgg disabled" @click="scrollTo('s-params')">Configurer op.gg →</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ELO -->
      <section class="sec" id="s-elo">
        <div class="sec-head">
          <div class="sec-title"><div class="sec-dot" style="background:var(--v4)"></div>ELO Équipe — Système K={{ state.kFactor }}</div>
        </div>
        <div class="elo-layout">
          <div class="elo-main">
            <div>
              <div class="kpi-label">ELO interne — Saison 2026</div>
              <div class="elo-num" :style="{ color: eloTierColor }">{{ state.teamElo }}</div>
              <div class="elo-tier-badge" :style="{ background: eloTierBg, color: eloTierColor }">{{ eloTierLabel }}</div>
            </div>
            <div class="elo-stats">
              <div class="es"><div class="es-val" style="color:var(--green)">{{ wins }}</div><div class="es-lbl">Victoires</div></div>
              <div class="es"><div class="es-val" style="color:var(--red)">{{ losses }}</div><div class="es-lbl">Défaites</div></div>
              <div class="es"><div class="es-val" style="color:var(--tx2)">{{ wr || 0 }}%</div><div class="es-lbl">Win Rate</div></div>
              <div class="es">
                <div class="es-val" :style="{ color: lastDelta === null ? 'var(--tx3)' : lastDelta >= 0 ? 'var(--green)' : 'var(--red)' }">{{ lastDelta === null ? '—' : (lastDelta >= 0 ? '+' : '') + lastDelta }}</div>
                <div class="es-lbl">Dernier</div>
              </div>
            </div>
            <div>
              <div class="kpi-label" style="margin-bottom:6px">Courbe ELO — {{ state.eloHistory.length - 1 }} matchs</div>
              <div class="chart-wrap" v-html="eloChart"></div>
            </div>
          </div>
          <div class="elo-ref">
            <div class="sec-title" style="font-size:10px;padding-bottom:10px;border-bottom:1px solid var(--bd);margin-bottom:8px"><div class="sec-dot" style="background:var(--v4)"></div>Table ELO</div>
            <div class="ref-grid">
              <div v-for="(t, k) in reversedTier" :key="k" class="ref-row">
                <div class="ref-lbl" :style="{ color: t.color }">{{ t.fr }}</div>
                <div class="ref-pts" :style="{ color: t.color }">{{ eloRange(k) }}</div>
              </div>
            </div>
            <div class="formula-box">
              <strong style="color:var(--v5);font-size:11px">Formule ELO (K={{ state.kFactor }})</strong><br>
              <code>ΔElo = K × (résultat − Ea)</code><br>
              <code>Ea = 1 / (1 + 10^(ΔElo/400))</code>
            </div>
          </div>
        </div>
      </section>

      <!-- SCRIMS -->
      <section class="sec" id="s-scrims">
        <div class="sec-head">
          <div class="sec-title"><div class="sec-dot" style="background:var(--orange)"></div>Historique des matchs</div>
          <button class="sec-action" @click="openAddMatch">＋ Ajouter</button>
        </div>
        <div class="scrims-layout">
          <div>
            <div class="mfilter-row">
              <button v-for="t in matchTypes" :key="t" class="mfbtn" :class="{ active: matchFilter === t }" @click="matchFilter = t">
                {{ t === 'all' ? `Tous (${state.matches.length})` : `${t} (${matchTypeCounts[t] || 0})` }}
              </button>
              <button class="mfbtn" style="margin-left:auto;background:rgba(109,40,217,.12);border-color:rgba(109,40,217,.28);color:var(--v5)" @click="openAddMatch">＋ Ajouter</button>
            </div>
            <div v-if="filteredMatches.length === 0" class="match-empty">Aucun match enregistré. Clique sur + Ajouter !</div>
            <template v-else>
              <div class="match-head">
                <div>Date</div><div>Adversaire</div><div>Résultat</div><div>Type</div><div>Score / Durée</div><div>Patch</div><div>Note</div>
              </div>
              <div v-for="m in sortedMatches" :key="m.id" class="match-row" :class="m.result === 'W' ? 'win' : m.result === 'L' ? 'loss' : 'draw'" @click="openEditMatch(m.id)">
                <div class="mc date">{{ m.date ? new Date(m.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—' }}</div>
                <div class="mc opp">{{ m.opp }}</div>
                <div class="mc"><span :class="`result-${m.result}`">{{ m.result === 'W' ? 'VICTOIRE' : m.result === 'L' ? 'DÉFAITE' : 'NUL' }}</span></div>
                <div class="mc"><span :class="`type-${m.type}`">{{ m.type }}</span></div>
                <div class="mc" style="font-size:11px">{{ m.score || '—' }} · {{ m.duration ? m.duration + 'min' : '—' }} · <span class="delta" :class="m.result === 'W' ? 'up' : m.result === 'L' ? 'dn' : 'neu'">{{ eloChangeStr(m) }}</span></div>
                <div class="mc" style="font-size:11px;color:var(--tx3)">{{ m.patch || '—' }}</div>
                <div class="mc note-cell">{{ m.note || '' }}</div>
              </div>
            </template>
          </div>
          <div class="wl-panel">
            <div>
              <div class="wl-title">Win Rate global</div>
              <div class="wl-summary">
                <div class="wl-wr" :style="{ color: wr >= 50 ? 'var(--green)' : 'var(--red)' }">{{ total > 0 ? wr + '%' : '—' }}</div>
                <div class="wl-wr-sub">{{ wins }}V — {{ losses }}D · {{ total }} matchs</div>
                <div class="wl-dots">
                  <div v-for="m in last10" :key="m.id" class="wl-dot" :style="{ background: m.result === 'W' ? 'var(--green)' : m.result === 'L' ? 'var(--red)' : 'var(--tx3)' }" :title="`${m.opp} · ${m.result}`"></div>
                </div>
              </div>
            </div>
            <div>
              <div class="wl-title">Par mois (4 derniers)</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <template v-for="r in monthBars" :key="r.lbl">
                  <div v-if="r.t > 0" class="wl-bar-row">
                    <div class="wl-bar-lbl">{{ r.lbl }}</div>
                    <div class="wl-bar-group">
                      <div class="wl-bar-track"><div class="wl-bar-fill" :style="{ width: r.w / maxMonthT * 100 + '%', background: 'var(--green)' }"></div></div>
                      <div class="wl-bar-track"><div class="wl-bar-fill" :style="{ width: r.l / maxMonthT * 100 + '%', background: 'var(--red)' }"></div></div>
                    </div>
                    <div class="wl-bar-nums">
                      <span class="wl-bar-n" style="color:var(--green)">{{ r.w }}V</span>
                      <span class="wl-bar-n" style="color:var(--red)">{{ r.l }}D</span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- OBJECTIFS -->
      <section class="sec" id="s-obj">
        <div class="sec-head">
          <div class="sec-title"><div class="sec-dot" style="background:var(--green)"></div>Objectifs de la saison</div>
          <button class="sec-action" @click="openAddObj">＋ Ajouter</button>
        </div>
        <div class="obj-list">
          <div v-if="!state.objectives.length" class="match-empty">Aucun objectif. Clique sur + Ajouter !</div>
          <div v-for="o in sortedObjectives" :key="o.id" class="obj-card" @click="openEditObj(o.id)">
            <div style="position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px" :style="{ background: o.priority==='high'?'var(--red)':o.priority==='low'?'var(--green)':'var(--yellow)' }"></div>
            <div class="obj-top">
              <div class="obj-name">{{ o.name }}</div>
              <div class="obj-badges">
                <span class="prio-badge" :class="`prio-${o.priority}`">{{ o.priority==='high'?'🔴 Urgent':o.priority==='low'?'🟢 Faible':'🟠 Normal' }}</span>
                <span class="status-badge" :class="`st-${o.status}`">{{ o.status==='done'?'Terminé':o.status==='progress'?'En cours':'À faire' }}</span>
              </div>
            </div>
            <div class="obj-bar-wrap">
              <div class="obj-bar-bg"><div class="obj-bar-fill" :style="{ width: (o.pct||0) + '%', background: o.priority==='high'?'var(--red)':o.priority==='low'?'var(--green)':'var(--yellow)' }"></div></div>
              <div class="obj-pct" :style="{ color: o.priority==='high'?'var(--red)':o.priority==='low'?'var(--green)':'var(--yellow)' }">{{ o.pct || 0 }}%</div>
            </div>
            <div v-if="o.deadline" class="obj-dl" :style="{ color: isOverdue(o) ? 'var(--red)' : 'var(--tx3)' }">📅 {{ isOverdue(o) ? '⚠ En retard · ' : '' }}Échéance : {{ new Date(o.deadline).toLocaleDateString('fr-FR',{day:'2-digit',month:'long'}) }}</div>
          </div>
        </div>
      </section>

      <!-- PARAMS -->
      <section class="sec" id="s-params">
        <div class="sec-head">
          <div class="sec-title"><div class="sec-dot" style="background:var(--tx3)"></div>Paramètres</div>
          <button class="sec-action" @click="saveSettings">✓ Enregistrer</button>
        </div>
        <div class="settings-grid">
          <div class="scard">
            <div class="scard-title">📊 Configuration ELO</div>
            <div class="field-row">
              <div class="field"><label>ELO de départ</label><input type="number" v-model.number="state.baseElo"></div>
              <div class="field"><label>Facteur K</label><input type="number" v-model.number="state.kFactor"></div>
            </div>
            <div class="field"><label>ELO adversaire par défaut</label><input type="number" v-model.number="state.defaultOppElo"></div>
          </div>
          <div class="scard">
            <div class="scard-title">🎯 Prochain événement</div>
            <div class="field"><label>Nom de l'événement</label><input type="text" v-model="state.nextEvent" placeholder="ex: Nexus Tour Phase 1"></div>
            <div class="field"><label>Date</label><input type="date" v-model="state.nextEventDate"></div>
            <div class="field"><label>Objectif tournoi</label><input type="text" v-model="state.goal" placeholder="ex: Top 4, Qualification…"></div>
          </div>
          <div class="scard" style="grid-column:span 2">
            <div class="scard-title">🔗 Identifiants op.gg des joueurs</div>
            <p style="font-size:10px;color:var(--tx3);margin-bottom:12px">Format : PseudoTag-EUW → lien op.gg/summoners/euw/[id]</p>
            <div v-for="p in state.roster" :key="p.id" class="rcr">
              <div class="rcr-emo">{{ p.emoji }}</div>
              <div class="rcr-name">{{ p.name }} <span :style="{ color: p.color, fontSize: '9px' }">{{ p.role }}</span></div>
              <input class="rcr-inp" v-model="p.opgg" placeholder="PseudoTag-EUW">
              <span style="font-size:9px;color:var(--tx3)">→ op.gg/summoners/euw/[id]</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- MODAL MATCH -->
    <div class="overlay" :class="{ open: matchModal }" @click.self="closeModals">
      <div class="modal">
        <div class="modal-head"><div class="modal-title">{{ editId ? 'Modifier le match' : 'Ajouter un match' }}</div><button class="modal-close" @click="closeModals">✕</button></div>
        <div class="modal-body">
          <div class="field-row">
            <div class="field"><label>Adversaire *</label><input type="text" v-model="mForm.opp" placeholder="Nom de l'équipe"></div>
            <div class="field"><label>Type</label><select v-model="mForm.type"><option>Scrim</option><option>Officiel</option><option>Amical</option></select></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Résultat</label><select v-model="mForm.result"><option value="W">✅ Victoire</option><option value="L">❌ Défaite</option><option value="D">〰 Nul</option></select></div>
            <div class="field"><label>Score (ex: 2-1)</label><input type="text" v-model="mForm.score" placeholder="—"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Date</label><input type="date" v-model="mForm.date"></div>
            <div class="field"><label>Patch (ex: 25.06)</label><input type="text" v-model="mForm.patch" placeholder="—"></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Durée (minutes)</label><input type="number" v-model.number="mForm.duration" placeholder="30"></div>
            <div class="field"><label>ELO adversaire</label><input type="number" v-model.number="mForm.oppElo" :placeholder="state.defaultOppElo"></div>
          </div>
          <div class="field"><label>Note / Observation</label><textarea v-model="mForm.note" rows="2" placeholder="Résumé, points forts/faibles…"></textarea></div>
          <div class="elo-prev">ELO actuel : <strong>{{ state.teamElo }}</strong> → <strong :style="{ color: eloPrevColor }">{{ state.teamElo + eloPrevDelta }}</strong> <span :style="{ color: eloPrevColor }">({{ eloPrevDelta >= 0 ? '+' : '' }}{{ eloPrevDelta }})</span></div>
        </div>
        <div class="modal-foot">
          <button v-if="editId" class="btn-danger" @click="deleteMatch">🗑 Supprimer</button>
          <button class="btn-cancel" @click="closeModals">Annuler</button>
          <button class="btn-confirm" @click="confirmMatch">{{ editId ? 'Enregistrer' : 'Ajouter' }}</button>
        </div>
      </div>
    </div>

    <!-- MODAL OBJECTIF -->
    <div class="overlay" :class="{ open: objModal }" @click.self="closeModals">
      <div class="modal">
        <div class="modal-head"><div class="modal-title">{{ editId ? "Modifier l'objectif" : 'Ajouter un objectif' }}</div><button class="modal-close" @click="closeModals">✕</button></div>
        <div class="modal-body">
          <div class="field"><label>Objectif *</label><input type="text" v-model="oForm.name" placeholder="Ex : Atteindre 8.5 CS/min en moyenne"></div>
          <div class="field-row">
            <div class="field"><label>Priorité</label><select v-model="oForm.priority"><option value="high">🔴 Urgent</option><option value="medium">🟠 Normal</option><option value="low">🟢 Faible</option></select></div>
            <div class="field"><label>Statut</label><select v-model="oForm.status"><option value="todo">À faire</option><option value="progress">En cours</option><option value="done">Terminé</option></select></div>
          </div>
          <div class="field-row">
            <div class="field"><label>Progression (%)</label><input type="number" v-model.number="oForm.pct" min="0" max="100"></div>
            <div class="field"><label>Échéance</label><input type="date" v-model="oForm.deadline"></div>
          </div>
        </div>
        <div class="modal-foot">
          <button v-if="editId" class="btn-danger" @click="deleteObj">🗑 Supprimer</button>
          <button class="btn-cancel" @click="closeModals">Annuler</button>
          <button class="btn-confirm" @click="confirmObj">{{ editId ? 'Enregistrer' : 'Ajouter' }}</button>
        </div>
      </div>
    </div>

    <div class="toast" :class="{ show: toast }">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import LoadingScreen from '../components/LoadingScreen.vue'

// ── TIER TABLE ──
const TIER = {
  IRON:        { fr:'FER',         color:'#9ca3af', bg:'rgba(156,163,175,.12)' },
  BRONZE:      { fr:'BRONZE',      color:'#b45309', bg:'rgba(180,83,9,.12)' },
  SILVER:      { fr:'ARGENT',      color:'#94a3b8', bg:'rgba(148,163,184,.12)' },
  GOLD:        { fr:'OR',          color:'#f59e0b', bg:'rgba(245,158,11,.12)' },
  PLATINUM:    { fr:'PLATINE',     color:'#06b6d4', bg:'rgba(6,182,212,.12)' },
  EMERALD:     { fr:'ÉMERAUDE',    color:'#22c55e', bg:'rgba(34,197,94,.12)' },
  DIAMOND:     { fr:'DIAMANT',     color:'#3b82f6', bg:'rgba(59,130,246,.12)' },
  MASTER:      { fr:'MASTER',      color:'#a855f7', bg:'rgba(168,85,247,.12)' },
  GRANDMASTER: { fr:'GRAND MAÎTRE',color:'#ef4444', bg:'rgba(239,68,68,.12)' },
  CHALLENGER:  { fr:'CHALLENGER',  color:'#f59e0b', bg:'rgba(245,158,11,.15)' },
  UNRANKED:    { fr:'NON CLASSÉ',  color:'#45405e', bg:'rgba(69,64,94,.12)' },
}
const reversedTier = Object.fromEntries(Object.entries(TIER).filter(([k])=>k!=='UNRANKED').reverse())

const loading   = ref(true)
const syncState = ref('offline')
const syncText  = ref('En attente…')
const syncTime  = ref('')
const flashOk   = ref(null)
const toast     = ref(false)
const toastMsg  = ref('')
const matchFilter = ref('all')
const matchModal = ref(false)
const objModal   = ref(false)
const editId     = ref(null)

const state = reactive({
  teamElo: 1200, baseElo: 1200, kFactor: 32, defaultOppElo: 1200,
  nextEvent: '', nextEventDate: '', goal: '',
  roster: [
    { id:'boulou',  name:'Boulou',  role:'Top',    emoji:'👍',  color:'#f97316', opgg:'', tier:'UNRANKED', rank:'', lp:0, wr:null },
    { id:'zugu',    name:'Zugu',    role:'Jungle', emoji:'🕊️', color:'#22c55e', opgg:'', tier:'UNRANKED', rank:'', lp:0, wr:null },
    { id:'lakrael', name:'Lakraël', role:'Mid',    emoji:'👀',  color:'#3b82f6', opgg:'', tier:'UNRANKED', rank:'', lp:0, wr:null },
    { id:'ke1do',   name:'Ke1do',   role:'ADC',    emoji:'🐯',  color:'#ef4444', opgg:'', tier:'UNRANKED', rank:'', lp:0, wr:null },
    { id:'joordy',  name:'Joordy',  role:'Support',emoji:'🥀',  color:'#a855f7', opgg:'', tier:'UNRANKED', rank:'', lp:0, wr:null },
  ],
  matches: [], objectives: [], eloHistory: [1200],
})

const mForm = reactive({ opp:'', type:'Scrim', result:'W', score:'', date:'', patch:'', duration:null, oppElo:1200, note:'' })
const oForm = reactive({ name:'', priority:'medium', status:'todo', pct:0, deadline:'' })

// ── ELO ──
function calcElo(te, oe, res, K) {
  const ea = 1 / (1 + Math.pow(10, (oe - te) / 400))
  return Math.round(K * ((res==='W'?1:res==='D'?.5:0) - ea))
}
function recomputeElo() {
  let elo = state.baseElo; const hist = [elo]
  ;[...state.matches].sort((a,b)=>a.date>b.date?1:-1).forEach(m => {
    elo = Math.max(0, elo + calcElo(elo, m.oppElo ?? state.defaultOppElo, m.result, state.kFactor))
    hist.push(elo)
  })
  state.teamElo = elo; state.eloHistory = hist
}
function getEloTier(e) {
  if(e>=2600)return{tier:'CHALLENGER',label:'Challenger'}
  if(e>=2400)return{tier:'GRANDMASTER',label:'Grand Maître'}
  if(e>=2200)return{tier:'MASTER',label:'Master'}
  if(e>=2000)return{tier:'DIAMOND',label:'Diamant'}
  if(e>=1800)return{tier:'EMERALD',label:'Émeraude'}
  if(e>=1600)return{tier:'PLATINUM',label:'Platine'}
  if(e>=1400)return{tier:'GOLD',label:'Or'}
  if(e>=1200)return{tier:'SILVER',label:'Argent'}
  if(e>=1000)return{tier:'BRONZE',label:'Bronze'}
  return{tier:'IRON',label:'Fer'}
}
function eloRange(t){return{IRON:'0–999',BRONZE:'1000–1199',SILVER:'1200–1399',GOLD:'1400–1599',PLATINUM:'1600–1799',EMERALD:'1800–1999',DIAMOND:'2000–2199',MASTER:'2200–2399',GRANDMASTER:'2400–2599',CHALLENGER:'2600+'}[t]||'—'}

const eloTier    = computed(() => getEloTier(state.teamElo))
const eloTierColor = computed(() => TIER[eloTier.value.tier]?.color || '#9ca3af')
const eloTierBg    = computed(() => TIER[eloTier.value.tier]?.bg || 'rgba(69,64,94,.12)')
const eloTierLabel = computed(() => eloTier.value.label)
const lastDelta    = computed(() => state.eloHistory.length >= 2 ? state.eloHistory[state.eloHistory.length-1] - state.eloHistory[state.eloHistory.length-2] : null)

const eloChart = computed(() => {
  const hist = state.eloHistory
  if (hist.length < 2) return '<div style="color:var(--tx3);font-size:10px;text-align:center;padding-top:32px">Ajoutez des matchs pour voir la courbe ELO</div>'
  const W=420, H=80, mn=Math.min(...hist)-30, mx=Math.max(...hist)+30
  const px = hist.map((v,i) => [(i/(hist.length-1))*W, H-((v-mn)/(mx-mn))*H])
  const last = hist[hist.length-1], prev = hist[hist.length-2]
  const lc = last >= prev ? 'var(--green)' : 'var(--red)'
  const ps = px.map(p=>p.join(',')).join(' ')
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lc}" stop-opacity=".25"/><stop offset="100%" stop-color="${lc}" stop-opacity="0"/></linearGradient></defs>
    <polygon points="${px[0][0]},${H} ${ps} ${px[px.length-1][0]},${H}" fill="url(#cg)"/>
    <polyline points="${ps}" fill="none" stroke="${lc}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${px[px.length-1][0]}" cy="${px[px.length-1][1]}" r="4" fill="${lc}"/>
  </svg>`
})

// ── STATS ──
const wins  = computed(() => state.matches.filter(m=>m.result==='W').length)
const losses = computed(() => state.matches.filter(m=>m.result==='L').length)
const total  = computed(() => wins.value + losses.value)
const wr     = computed(() => total.value > 0 ? Math.round(wins.value/total.value*100) : null)

const now = new Date()
const weekMatches  = computed(() => {
  const mon = new Date(now); mon.setDate(now.getDate()-(now.getDay()||7)+1); mon.setHours(0,0,0,0)
  return state.matches.filter(m => m.date && new Date(m.date) >= mon)
})
const weekWins   = computed(() => weekMatches.value.filter(m=>m.result==='W').length)
const weekLosses = computed(() => weekMatches.value.filter(m=>m.result==='L').length)
const monthMatches = computed(() => state.matches.filter(m=>m.date?.startsWith(now.toISOString().slice(0,7))).length)
const monthOfficial = computed(() => state.matches.filter(m=>m.type==='Officiel'&&m.date?.startsWith(now.toISOString().slice(0,7))).length)

const streakText = computed(() => {
  let streak=0, sType=''
  ;[...state.matches].sort((a,b)=>b.date>a.date?1:-1).forEach(m=>{
    if(!sType){sType=m.result;streak=1}else if(m.result===sType)streak++
  })
  return streak===0?'—':sType==='W'?`${streak}W`:sType==='L'?`${streak}L`:`${streak}N`
})
const streakClass = computed(() => streakText.value.endsWith('W')?'up':streakText.value.endsWith('L')?'dn':'neu')

const formatEventDate = computed(() => state.nextEventDate ? new Date(state.nextEventDate+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '')
const daysLeft = computed(() => state.nextEventDate ? Math.ceil((new Date(state.nextEventDate+'T12:00')-now)/86400000) : null)

const todayLabel = computed(() => now.toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}))
function gwn(d){const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=dt.getUTCDay()||7;dt.setUTCDate(dt.getUTCDate()+4-day);const y1=new Date(Date.UTC(dt.getUTCFullYear(),0,1));return Math.ceil((((dt-y1)/86400000)+1)/7)}
const weekLabel = computed(() => 'Semaine ' + gwn(now) + ' · ' + now.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}))

const last10 = computed(() => [...state.matches].sort((a,b)=>b.date>a.date?1:-1).slice(0,10).reverse())
const monthBars = computed(() => {
  const res = []
  for(let i=0;i<4;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1)
    const key=d.toISOString().slice(0,7)
    const lbl=d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})
    const mm=state.matches.filter(m=>m.date?.startsWith(key))
    res.push({lbl,w:mm.filter(m=>m.result==='W').length,l:mm.filter(m=>m.result==='L').length,t:mm.length})
  }
  return res
})
const maxMonthT = computed(() => Math.max(...monthBars.value.map(r=>r.t),1))
const openObjCount = computed(() => state.objectives.filter(o=>o.status!=='done').length)

const matchTypes = computed(() => ['all',...new Set(state.matches.map(m=>m.type))])
const matchTypeCounts = computed(() => { const c={}; state.matches.forEach(m=>c[m.type]=(c[m.type]||0)+1); return c })
const filteredMatches = computed(() => matchFilter.value==='all' ? state.matches : state.matches.filter(m=>m.type===matchFilter.value))
const sortedMatches = computed(() => [...filteredMatches.value].sort((a,b)=>b.date>a.date?1:-1))
const sortedObjectives = computed(() => [...state.objectives].sort((a,b)=>({high:0,medium:1,low:2}[a.priority??'medium'])-({high:0,medium:1,low:2}[b.priority??'medium'])))

function isOverdue(o) { return o.deadline && o.deadline < new Date().toISOString().split('T')[0] && o.status !== 'done' }
function eloChangeStr(m) {
  const d = calcElo(state.teamElo, m.oppElo ?? state.defaultOppElo, m.result, state.kFactor)
  return m.result==='W' ? `+${Math.abs(d)}` : m.result==='L' ? `-${Math.abs(d)}` : '±0'
}

const eloPrevDelta = computed(() => calcElo(state.teamElo, mForm.oppElo || state.defaultOppElo, mForm.result, state.kFactor))
const eloPrevColor = computed(() => eloPrevDelta.value > 0 ? 'var(--green)' : eloPrevDelta.value < 0 ? 'var(--red)' : 'var(--tx3)')

// ── MODALS ──
function openAddMatch() {
  editId.value = null
  Object.assign(mForm, { opp:'', type:'Scrim', result:'W', score:'', date: now.toISOString().split('T')[0], patch:'', duration:null, oppElo: state.defaultOppElo, note:'' })
  matchModal.value = true
}
function openEditMatch(id) {
  const m = state.matches.find(x=>x.id===id); if (!m) return
  editId.value = id
  Object.assign(mForm, { opp:m.opp, type:m.type, result:m.result, score:m.score||'', date:m.date||'', patch:m.patch||'', duration:m.duration||null, oppElo:m.oppElo??state.defaultOppElo, note:m.note||'' })
  matchModal.value = true
}
function confirmMatch() {
  if (!mForm.opp.trim()) { showToast('L\'adversaire est requis'); return }
  const data = { opp:mForm.opp.trim(), type:mForm.type, result:mForm.result, score:mForm.score.trim(), date:mForm.date, patch:mForm.patch.trim(), duration:mForm.duration||null, oppElo:mForm.oppElo||state.defaultOppElo, note:mForm.note.trim() }
  if (editId.value) Object.assign(state.matches.find(m=>m.id===editId.value), data)
  else state.matches.push({ id:uid(), ...data })
  closeModals(); recomputeElo(); save()
}
function deleteMatch() {
  if (!confirm('Supprimer ce match ?')) return
  state.matches = state.matches.filter(m=>m.id!==editId.value)
  closeModals(); recomputeElo(); save()
}
function openAddObj() {
  editId.value = null
  Object.assign(oForm, { name:'', priority:'medium', status:'todo', pct:0, deadline:'' })
  objModal.value = true
}
function openEditObj(id) {
  const o = state.objectives.find(x=>x.id===id); if(!o) return
  editId.value = id
  Object.assign(oForm, { name:o.name, priority:o.priority, status:o.status, pct:o.pct??0, deadline:o.deadline||'' })
  objModal.value = true
}
function confirmObj() {
  if (!oForm.name.trim()) { showToast('L\'objectif est requis'); return }
  const data = { name:oForm.name.trim(), priority:oForm.priority, status:oForm.status, pct:Math.min(100,Math.max(0,oForm.pct||0)), deadline:oForm.deadline }
  if (editId.value) Object.assign(state.objectives.find(o=>o.id===editId.value), data)
  else state.objectives.push({ id:uid(), ...data })
  closeModals(); save()
}
function deleteObj() {
  if (!confirm('Supprimer cet objectif ?')) return
  state.objectives = state.objectives.filter(o=>o.id!==editId.value)
  closeModals(); save()
}
function closeModals() { matchModal.value = false; objModal.value = false }
function saveRoster() { save(); showToast('Rangs sauvegardés ✓') }
function saveSettings() { recomputeElo(); save(); showToast('Paramètres enregistrés ✓') }
function scrollTo(id) { document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }) }
function showToast(msg) { toastMsg.value=msg; toast.value=true; setTimeout(()=>{ toast.value=false },2600) }

const syncStateColor = computed(() => ({ connected:'var(--green)', syncing:'var(--yellow)', error:'var(--red)', offline:'var(--tx3)' }[syncState.value] || 'var(--tx3)'))

// ── FIREBASE ──
function getStateForSave() {
  return { teamElo:state.teamElo, baseElo:state.baseElo, kFactor:state.kFactor, defaultOppElo:state.defaultOppElo, nextEvent:state.nextEvent, nextEventDate:state.nextEventDate, goal:state.goal, roster:state.roster, matches:state.matches, objectives:state.objectives, eloHistory:state.eloHistory }
}
function applyState(s) {
  if (!s) return
  Object.assign(state, { teamElo:s.teamElo??1200, baseElo:s.baseElo??1200, kFactor:s.kFactor??32, defaultOppElo:s.defaultOppElo??1200, nextEvent:s.nextEvent||'', nextEventDate:s.nextEventDate||'', goal:s.goal||'', matches:s.matches??[], objectives:s.objectives??[], eloHistory:s.eloHistory??[s.baseElo??1200] })
  if(s.roster?.length) s.roster.forEach((sr,i)=>{ if(state.roster[i]) Object.assign(state.roster[i],{opgg:sr.opgg||'',tier:sr.tier||'UNRANKED',rank:sr.rank||'',lp:sr.lp||0,wr:sr.wr??null}) })
}
async function save() {
  syncState.value='syncing'; syncText.value='Sauvegarde…'
  try {
    await setDoc(doc(db,'plazma','dashboard'), getStateForSave())
    syncState.value='connected'; syncText.value='Synchronisé'; flash(true)
  } catch(e) { syncState.value='error'; syncText.value='Erreur Firebase'; flash(false); console.error(e) }
}
function flash(ok) { flashOk.value=ok; setTimeout(()=>{ flashOk.value=null },1600) }
function exportBackup() { const b=new Blob([JSON.stringify(getStateForSave(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='plazma-dashboard-'+new Date().toISOString().split('T')[0]+'.json'; a.click() }
function importBackup() { const i=document.createElement('input'); i.type='file'; i.accept='.json'; i.addEventListener('change',async()=>{ try{ applyState(JSON.parse(await i.files[0].text())); recomputeElo(); save(); showToast('Backup importé ✓') }catch(e){ alert('Fichier invalide') } }); i.click() }
function resetData() { if(!confirm('Réinitialiser tout le dashboard ?')) return; Object.assign(state,{teamElo:1200,baseElo:1200,kFactor:32,defaultOppElo:1200,nextEvent:'',nextEventDate:'',goal:'',matches:[],objectives:[],eloHistory:[1200]}); deleteDoc(doc(db,'plazma','dashboard')).then(()=>{ syncState.value='connected'; syncText.value='Réinitialisé'; syncTime.value='' }) }

let _uidC=0
function uid(){ return Date.now().toString(36)+(++_uidC).toString(36) }

let unsubscribe = null
function startSync() {
  syncState.value='syncing'; syncText.value='Connexion…'
  unsubscribe = onSnapshot(doc(db,'plazma','dashboard'), snapshot => {
    if(snapshot.metadata.hasPendingWrites) return
    if(snapshot.exists()){ applyState(snapshot.data()); recomputeElo() }
    syncState.value='connected'; syncText.value='Synchronisé'; syncTime.value=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
    loading.value = false
  }, err => { console.error(err); syncState.value='error'; syncText.value='Erreur connexion'; loading.value=false; recomputeElo() })
  setTimeout(()=>{ if(loading.value){ loading.value=false; syncState.value='error'; syncText.value='Firebase inaccessible'; recomputeElo() } },8000)
}

onMounted(startSync)
onUnmounted(()=>{ if(unsubscribe) unsubscribe() })

document.addEventListener('keydown', e => { if(e.key==='Escape') closeModals() })
</script>

<style scoped>
:root { --v1:#5b21b6;--v2:#6d28d9;--v3:#7c3aed;--v4:#8b5cf6;--v5:#a78bfa;--sbw:230px;--purple:var(--v3); }
.db-layout { display:flex; min-height:100vh; font-family:'Barlow',sans-serif; background:var(--bg); }
.sidebar { position:fixed;left:0;top:0;bottom:0;width:230px;background:var(--bg2);border-right:1px solid var(--bd);z-index:100;display:flex;flex-direction:column; }
.sb-logo { display:flex;align-items:center;gap:11px;padding:20px 18px 18px;border-bottom:1px solid var(--bd); }
.sb-badge { width:34px;height:34px;background:linear-gradient(135deg,#6d28d9,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 0 16px rgba(109,40,217,.45); }
.sb-name { font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;letter-spacing:3px;text-transform:uppercase;background:linear-gradient(135deg,#fff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.sb-sub { font-size:8px;color:var(--tx3);letter-spacing:2px;text-transform:uppercase; }
.sb-nav { flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:1px;overflow-y:auto;scrollbar-width:none; }
.sb-nav::-webkit-scrollbar { display:none; }
.nav-sep { font-size:8px;letter-spacing:2.5px;text-transform:uppercase;color:var(--tx3);padding:8px 8px 4px;margin-top:6px; }
.nav-a { display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;cursor:pointer;transition:all .15s;color:var(--tx2);font-size:12px;font-weight:500;border:1px solid transparent;text-decoration:none;user-select:none; }
.nav-a:hover { background:rgba(139,92,246,.08);color:var(--tx);border-color:rgba(139,92,246,.14); }
.nav-a.active { background:rgba(139,92,246,.14);color:#a78bfa;border-color:rgba(139,92,246,.22); }
.nav-ic { font-size:13px;width:18px;text-align:center;flex-shrink:0; }
.nav-badge { margin-left:auto;background:var(--sf);border-radius:99px;padding:1px 7px;font-size:9px;font-weight:700;color:var(--tx3); }
.sb-foot { padding:12px;border-top:1px solid var(--bd); }
.sync-row { display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:6px;background:var(--sf);border:1px solid var(--bd2);margin-bottom:8px; }
.sync-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;transition:background .3s; }
.sync-dot.connected { background:var(--green);box-shadow:0 0 5px rgba(34,197,94,.5); }
.sync-dot.syncing { background:var(--yellow);animation:pulse .8s infinite; }
.sync-dot.error { background:var(--red); }
.sync-dot.offline { background:var(--tx3); }
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.sync-txt { font-size:9px;font-weight:600;flex:1; }
.sync-t { font-size:8px;color:var(--tx3); }
.btn-save { width:100%;background:rgba(109,40,217,.18);border:1px solid rgba(109,40,217,.35);color:#a78bfa;padding:8px;border-radius:7px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .2s;margin-bottom:6px; }
.btn-save:hover { background:rgba(109,40,217,.3); }
.btn-save.saved { background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.3);color:var(--green); }
.btn-row { display:flex;gap:4px; }
.btn-mini { flex:1;background:var(--sf);border:1px solid var(--bd);color:var(--tx3);padding:5px;border-radius:5px;font-size:8px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;text-align:center;transition:color .15s; }
.btn-mini:hover { color:var(--tx2); }
.btn-mini.red:hover { color:var(--red); }
.main { margin-left:230px;padding:24px 28px 80px;display:flex;flex-direction:column;gap:24px; }
.topbar { display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap; }
.pg-title { font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:800;letter-spacing:2px;text-transform:uppercase; }
.pg-sub { font-size:10px;color:var(--tx3);letter-spacing:1px;text-transform:uppercase;margin-top:2px; }
.topbar-right { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.date-chip { background:var(--sf);border:1px solid var(--bd);border-radius:6px;padding:6px 12px;font-size:11px;color:var(--tx2); }
.btn { padding:8px 18px;border-radius:7px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border:none;font-family:'Barlow',sans-serif;transition:all .18s; }
.btn-primary { background:#7c3aed;color:#fff;box-shadow:0 0 20px rgba(124,58,237,.35); }
.btn-primary:hover { background:#8b5cf6;transform:translateY(-1px); }
.sec { background:var(--bg2);border:1px solid var(--bd);border-radius:14px;overflow:hidden; }
.sec-head { padding:16px 20px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--sf); }
.sec-title { font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;display:flex;align-items:center;gap:7px;color:var(--tx2); }
.sec-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }
.sec-action { background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.25);color:#a78bfa;padding:5px 13px;border-radius:6px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s; }
.sec-action:hover { background:rgba(139,92,246,.22); }
.kpi-strip { display:grid;grid-template-columns:repeat(6,1fr);gap:10px; }
.kpi { background:var(--bg2);border:1px solid var(--bd);border-radius:14px;padding:20px 20px 18px;position:relative;overflow:hidden;transition:border-color .15s; }
.kpi:hover { border-color:var(--bd2); }
.kpi::after { content:'';position:absolute;top:0;left:0;right:0;height:2px;border-radius:2px 2px 0 0; }
.kpi-wr::after { background:linear-gradient(90deg,var(--green),transparent); }
.kpi-scrims::after { background:linear-gradient(90deg,var(--orange),transparent); }
.kpi-elo::after { background:linear-gradient(90deg,#8b5cf6,transparent); }
.kpi-streak::after { background:linear-gradient(90deg,var(--yellow),transparent); }
.kpi-month::after { background:linear-gradient(90deg,var(--cyan),transparent); }
.kpi-event::after { background:linear-gradient(90deg,var(--pink),transparent); }
.kpi-glow { position:absolute;bottom:-20px;right:-20px;width:90px;height:90px;border-radius:50%;opacity:.06;pointer-events:none; }
.kpi-label { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:10px;font-weight:600; }
.kpi-val { font-family:'Barlow Condensed',sans-serif;font-size:42px;font-weight:900;line-height:1;margin-bottom:6px;letter-spacing:-1px; }
.kpi-sub { font-size:10px;color:var(--tx3);line-height:1.4; }
.kpi-sub b { color:var(--tx2); }
.delta { font-family:'Barlow Condensed',sans-serif;font-weight:800; }
.delta.up{color:var(--green)}.delta.dn{color:var(--red)}.delta.neu{color:var(--tx3)}
.roster-grid { display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:16px; }
.pcard { background:var(--sf);border:1px solid var(--bd);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .18s; }
.pcard:hover { border-color:var(--bd2); }
.pc-strip { height:3px; }
.pc-head { padding:12px 14px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--bd); }
.pc-emo { font-size:22px; }
.pc-name { font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:800;letter-spacing:.5px; }
.pc-role { font-size:8px;letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:1px; }
.pc-body { padding:10px 14px;flex:1;display:flex;flex-direction:column;gap:8px; }
.pc-lbl { font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:var(--tx3);font-weight:600;margin-bottom:3px; }
.pc-rank-display { font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:800;line-height:1.2; }
.pc-lp { font-size:10px;color:var(--tx3);margin-top:2px; }
.pc-sel { background:var(--sf);border:1px solid var(--bd);color:var(--tx);font-size:11px;font-family:'Barlow',sans-serif;padding:5px 8px;border-radius:6px;outline:none;width:100%; }
.pc-row { display:flex;gap:6px; }
.pc-inp { flex:1;background:var(--sf);border:1px solid var(--bd);color:var(--tx);font-size:11px;font-family:'Barlow',sans-serif;padding:5px 8px;border-radius:6px;outline:none;transition:border-color .15s;width:100%; }
.pc-inp:focus { border-color:#8b5cf6; }
.btn-opgg { background:rgba(6,182,212,.1);border:1px solid rgba(6,182,212,.25);color:var(--cyan);padding:6px 10px;border-radius:6px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:4px;width:100%;text-decoration:none;margin-top:4px; }
.btn-opgg:hover { background:rgba(6,182,212,.2); }
.btn-opgg.disabled { opacity:.35;cursor:default;pointer-events:none; }
.elo-layout { display:grid;grid-template-columns:1fr 260px; }
.elo-main { padding:20px 24px;display:flex;flex-direction:column;gap:18px; }
.elo-num { font-family:'Barlow Condensed',sans-serif;font-size:72px;font-weight:900;line-height:1;letter-spacing:-2px; }
.elo-tier-badge { display:inline-block;padding:3px 14px;border-radius:5px;font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:4px; }
.elo-stats { display:flex;gap:24px; }
.es { display:flex;flex-direction:column;gap:2px; }
.es-val { font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800; }
.es-lbl { font-size:9px;color:var(--tx3);letter-spacing:1.5px;text-transform:uppercase; }
.chart-wrap { background:var(--sf);border-radius:8px;padding:8px;height:90px;display:flex;align-items:center; }
.chart-wrap svg { width:100%;height:100%;display:block; }
.elo-ref { border-left:1px solid var(--bd);padding:16px;background:var(--sf); }
.ref-grid { display:flex;flex-direction:column;gap:4px; }
.ref-row { display:flex;align-items:center;justify-content:space-between;padding:4px 6px;border-radius:5px; }
.ref-lbl { font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase; }
.ref-pts { font-size:10px;font-weight:600; }
.formula-box { background:var(--sf);border:1px solid var(--bd);border-radius:7px;padding:10px 12px;font-size:10px;color:var(--tx3);line-height:1.7;margin-top:10px; }
.formula-box code { font-family:monospace;font-size:10px;color:var(--tx2); }
.scrims-layout { display:grid;grid-template-columns:1fr 280px; }
.mfilter-row { display:flex;gap:6px;padding:12px 20px;flex-wrap:wrap;border-bottom:1px solid var(--bd); }
.mfbtn { background:var(--sf);border:1px solid var(--bd);color:var(--tx3);padding:4px 12px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s; }
.mfbtn:hover { color:var(--tx2); }
.mfbtn.active { background:rgba(139,92,246,.15);border-color:rgba(139,92,246,.3);color:#a78bfa; }
.match-head { display:grid;grid-template-columns:80px 1fr 110px 80px 110px 60px 1fr;padding:8px 20px;background:var(--sf);border-bottom:2px solid var(--bd2); }
.match-head div { font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);font-weight:700; }
.match-row { display:grid;grid-template-columns:80px 1fr 110px 80px 110px 60px 1fr;padding:11px 20px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .12s;align-items:center;border-left:3px solid transparent; }
.match-row:hover { background:rgba(255,255,255,.015); }
.match-row.win { border-left-color:var(--green); }
.match-row.loss { border-left-color:var(--red); }
.match-row.draw { border-left-color:var(--tx3); }
.mc { font-size:12px;color:var(--tx2); }
.mc.date { color:var(--tx3);font-size:11px; }
.mc.opp { font-weight:600;color:var(--tx); }
.mc.note-cell { font-size:10px;color:var(--tx3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.result-W { color:var(--green);font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;letter-spacing:1px; }
.result-L { color:var(--red);font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;letter-spacing:1px; }
.result-D { color:var(--tx3);font-family:'Barlow Condensed',sans-serif;font-size:12px;font-weight:800;letter-spacing:1px; }
.type-Scrim { background:rgba(99,102,241,.12);color:#818cf8;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase; }
.type-Officiel { background:rgba(245,158,11,.12);color:var(--yellow);padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase; }
.type-Amical { background:rgba(34,197,94,.1);color:var(--green);padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase; }
.match-empty { padding:32px;text-align:center;color:var(--tx3);font-size:12px; }
.wl-panel { border-left:1px solid var(--bd);padding:18px;background:var(--sf);display:flex;flex-direction:column;gap:16px; }
.wl-title { font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);font-weight:700;margin-bottom:2px; }
.wl-summary { background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:14px;text-align:center; }
.wl-wr { font-family:'Barlow Condensed',sans-serif;font-size:36px;font-weight:900;line-height:1; }
.wl-wr-sub { font-size:10px;color:var(--tx3);letter-spacing:1px;text-transform:uppercase;margin-top:3px; }
.wl-dots { display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;justify-content:center; }
.wl-dot { width:11px;height:11px;border-radius:2px; }
.wl-bar-row { display:flex;align-items:center;gap:8px; }
.wl-bar-lbl { min-width:30px;font-size:9px;color:var(--tx3);letter-spacing:1px;text-transform:uppercase; }
.wl-bar-group { flex:1;display:flex;flex-direction:column;gap:2px; }
.wl-bar-track { height:7px;background:var(--sf);border-radius:3px;overflow:hidden; }
.wl-bar-fill { height:100%;border-radius:3px;transition:width .4s; }
.wl-bar-nums { display:flex;flex-direction:column;align-items:flex-end;gap:2px; }
.wl-bar-n { font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;line-height:1; }
.obj-list { padding:12px 16px;display:flex;flex-direction:column;gap:8px; }
.obj-card { background:var(--sf);border:1px solid var(--bd);border-radius:9px;padding:13px 16px 13px 18px;cursor:pointer;transition:all .15s;position:relative; }
.obj-card:hover { border-color:var(--bd2); }
.obj-top { display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px; }
.obj-name { font-size:13px;font-weight:600;color:var(--tx);flex:1; }
.obj-badges { display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap; }
.prio-badge { font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 7px;border-radius:3px; }
.prio-high { background:rgba(239,68,68,.12);color:var(--red); }
.prio-medium { background:rgba(245,158,11,.12);color:var(--yellow); }
.prio-low { background:rgba(34,197,94,.12);color:var(--green); }
.status-badge { font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 7px;border-radius:3px; }
.st-todo { background:rgba(148,163,184,.1);color:var(--tx3); }
.st-progress { background:rgba(59,130,246,.12);color:var(--blue); }
.st-done { background:rgba(34,197,94,.12);color:var(--green); }
.obj-bar-wrap { display:flex;align-items:center;gap:10px; }
.obj-bar-bg { flex:1;height:6px;background:var(--bd2);border-radius:3px;overflow:hidden; }
.obj-bar-fill { height:100%;border-radius:3px;transition:width .3s; }
.obj-pct { font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:800;min-width:36px;text-align:right; }
.obj-dl { font-size:9px;margin-top:6px; }
.settings-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px; }
.scard { background:var(--sf);border:1px solid var(--bd);border-radius:9px;padding:14px; }
.scard-title { font-family:'Barlow Condensed',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a78bfa;margin-bottom:12px; }
.field { margin-bottom:10px; }
.field label { display:block;font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--tx3);margin-bottom:5px; }
.field input,.field select,.field textarea { width:100%;background:var(--sf);border:1px solid var(--bd);color:var(--tx);padding:7px 10px;border-radius:6px;font-size:12px;font-family:'Barlow',sans-serif;outline:none;transition:border-color .2s;resize:none; }
.field input:focus,.field select:focus { border-color:#7c3aed; }
.field select option { background:var(--sf); }
.field-row { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
.rcr { display:grid;grid-template-columns:24px 110px 1fr 1fr;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bd); }
.rcr:last-child { border-bottom:none; }
.rcr-emo { font-size:15px; }
.rcr-name { font-size:11px;color:var(--tx2); }
.rcr-inp { background:var(--sf);border:1px solid var(--bd);color:var(--tx);padding:5px 8px;border-radius:5px;font-size:11px;font-family:'Barlow',sans-serif;outline:none;transition:border-color .15s;width:100%; }
.rcr-inp:focus { border-color:#7c3aed; }
.overlay { display:none;position:fixed;inset:0;background:rgba(5,5,13,.88);backdrop-filter:blur(8px);z-index:300;align-items:center;justify-content:center;padding:20px; }
.overlay.open { display:flex; }
.modal { background:var(--sf);border:1px solid var(--bd2);border-radius:14px;width:500px;max-width:100%;box-shadow:0 0 80px rgba(0,0,0,.7); }
.modal-head { padding:18px 22px 14px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between; }
.modal-title { font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#a78bfa; }
.modal-close { background:none;border:none;color:var(--tx3);font-size:18px;cursor:pointer;transition:color .15s;line-height:1; }
.modal-close:hover { color:var(--tx); }
.modal-body { padding:18px 22px;display:flex;flex-direction:column;gap:10px; }
.modal-foot { padding:0 22px 18px;display:flex;gap:8px;justify-content:flex-end; }
.btn-danger { background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:var(--red);padding:8px 16px;border-radius:7px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s;margin-right:auto; }
.btn-cancel { background:var(--bg2);color:var(--tx2);border:1px solid var(--bd);padding:8px 16px;border-radius:7px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s; }
.btn-cancel:hover { border-color:var(--bd2);color:var(--tx); }
.btn-confirm { background:#7c3aed;color:#fff;border:none;padding:8px 20px;border-radius:7px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer;font-family:'Barlow',sans-serif;transition:all .15s; }
.btn-confirm:hover { background:#8b5cf6; }
.elo-prev { background:var(--bg2);border:1px solid var(--bd);border-radius:6px;padding:8px 12px;font-size:11px;color:var(--tx3);margin-top:4px; }
.toast { position:fixed;bottom:24px;left:calc(230px + 24px);background:var(--sf);border:1px solid var(--bd2);border-radius:8px;padding:10px 16px;font-size:11px;font-weight:600;color:var(--tx);z-index:500;opacity:0;transition:opacity .3s;pointer-events:none; }
.toast.show { opacity:1; }
.hub-link { font-size:10px;color:var(--tx3);text-decoration:none;letter-spacing:1px;transition:color .15s; }
.hub-link:hover { color:#a78bfa; }
@media(max-width:1280px){ .kpi-strip{grid-template-columns:repeat(3,1fr)} }
@media(max-width:900px){ .kpi-strip{grid-template-columns:repeat(2,1fr)} .roster-grid{grid-template-columns:repeat(3,1fr)} .scrims-layout,.elo-layout{grid-template-columns:1fr} }
@media(max-width:700px){ .sidebar{display:none} .main{margin-left:0;padding:16px} }
</style>
