'use client';

import { useMemo, useState } from 'react';
import ResponseTab from '@/components/response/ResponseTab';
import { IconCheck, IconInfo, IconPin, IconSplit, IconUndo } from '@/components/ui/icons';
import { Button, LiveNumber, Segmented, StatusBadge, Switch } from '@/components/ui/primitives';
import { compass, nf, nfRough, stepToClock } from '@/lib/format';
import { CAR_T_CO2_PER_YEAR, type CarbonEstimate } from '@/lib/sim/carbon';
import { ispuOf } from '@/lib/pantau';
import { plumeReach, SMOKE_THRESHOLDS, type SmokeModel } from '@/lib/sim/smoke';
import { BREAK_COLORS, BREAK_LABELS, breakSentence, describeBreak, fmtCoord, ignitionPoint } from '@/lib/geo';
import { locale, t as tr } from '@/lib/i18n';
import type { PlanSet, ResponsePlan } from '@/lib/response/types';
import { FIREBREAK_BUILD_HOURS, RISK_THRESHOLDS, STEP_MINUTES } from '@/lib/sim/params';
import { useSim } from '@/stores/simStore';

const LEVEL_RULES = () =>
  [
    ['var(--color-danger)', tr('Danger', 'Awas'), tr(`fire < ${RISK_THRESHOLDS.awas} h`, `api < ${RISK_THRESHOLDS.awas} jam`)],
    ['var(--color-alert)', tr('Alert', 'Siaga'), tr(`${RISK_THRESHOLDS.awas}–${RISK_THRESHOLDS.siaga} h`, `${RISK_THRESHOLDS.awas}–${RISK_THRESHOLDS.siaga} jam`)],
    ['var(--color-warn)', tr('Watch', 'Waspada'), tr(`> ${RISK_THRESHOLDS.siaga} h`, `> ${RISK_THRESHOLDS.siaga} jam`)],
    ['var(--color-ok)', tr('Safe', 'Aman'), tr('not reached', 'tidak terjangkau')],
  ] as const;

/* ---------------- Emisi karbon ---------------- */
/** Dampak iklim: perkiraan CO2 dari area terbakar, dan yang dicegah sekat bila sudah diterapkan. */
function CarbonCard({ main, base }: { main: CarbonEstimate; base: CarbonEstimate | null }) {
  const [open, setOpen] = useState(false);
  const saved = base ? Math.max(0, base.tCO2 - main.tCO2) : 0;
  const cars = main.tCO2 / CAR_T_CO2_PER_YEAR;
  return (
    <section aria-labelledby="karbon-h" className="rounded-[8px] border border-line bg-black/20 px-3 py-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="karbon-h" className="font-semibold text-text-secondary">
          {tr('Potential CO₂ released', 'Potensi CO₂ dilepas')}
        </h3>
        <span className="num text-lg font-bold text-text-primary">≈ {nfRough(main.tCO2)} t</span>
      </div>
      <p className="mt-1 leading-6 text-text-secondary">
        {tr(
          `About the yearly emissions of ${nfRough(cars)} cars.`,
          `Kira-kira setara emisi setahun ${nfRough(cars)} mobil.`,
        )}{' '}
        {main.peatShare > 0.05 &&
          tr(
            `${Math.round(main.peatShare * 100)}% comes from burning peat (${nf(main.peatHa, 0)} ha), which stores carbon built up over thousands of years.`,
            `${Math.round(main.peatShare * 100)}% berasal dari gambut terbakar (${nf(main.peatHa, 0)} ha), yang menyimpan karbon ribuan tahun.`,
          )}
      </p>
      {base && saved > 0 && (
        <p className="mt-2 rounded-[6px] bg-[#2fb67c]/15 px-2.5 py-1.5 font-semibold text-ok-ink">
          {tr(`The firebreak avoids about ${nfRough(saved)} t CO₂.`, `Sekat mencegah sekitar ${nfRough(saved)} t CO₂.`)}
        </p>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 text-xs font-semibold text-sun underline-offset-4 hover:underline">
        {open ? tr('Hide method', 'Sembunyikan cara hitung') : tr('How is this counted?', 'Bagaimana menghitungnya?')}
      </button>
      {open && (
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          {tr(
            'Burned area per land type x IPCC default emission factors: peat 600 t CO₂/ha (IPCC 2013 Wetlands Supplement), primary forest 133, secondary forest and plantation 67, shrub 43, open land 10 t CO₂/ha (IPCC 2006). CO₂ only; methane is not included. This is the potential if the burned peat smoulders out, which usually takes days, not 12 hours. An order-of-magnitude estimate, not an official inventory.',
            'Luas terbakar per jenis lahan x faktor emisi bawaan IPCC: gambut 600 t CO₂/ha (IPCC 2013 Wetlands Supplement), hutan primer 133, hutan sekunder dan perkebunan 67, semak 43, lahan terbuka 10 t CO₂/ha (IPCC 2006). Hanya CO₂; metana belum dihitung. Ini potensi bila gambut yang terbakar membara sampai habis, yang biasanya butuh berhari-hari, bukan 12 jam. Perkiraan orde besaran, bukan inventarisasi resmi.',
          )}
        </p>
      )}
    </section>
  );
}

/* ---------------- Prediksi asap ---------------- */
/** Desa dan kota yang terkena asap (PM2.5) dalam 12 jam, dari model sebaran asap. */
function SmokeCard({ model, step }: { model: SmokeModel; step: number }) {
  const [open, setOpen] = useState(false);
  const reach = useMemo(() => plumeReach(model, model.steps - 1), [model]);
  const hit = model.targets
    .filter((x) => x.peak > SMOKE_THRESHOLDS.sedang)
    .sort((a, b) => (a.noticeableStep ?? 99) - (b.noticeableStep ?? 99) || b.peak - a.peak);
  const shown = open ? hit : hit.slice(0, 6);
  const unhealthyVillages = hit.filter((x) => x.kind === 'village' && x.unhealthyStep !== null);
  return (
    <section aria-labelledby="asap-h" className="rounded-[8px] border border-line bg-black/20 px-3 py-3 text-sm">
      <h3 id="asap-h" className="font-semibold">
        {tr('Smoke in the next 12 h (estimate)', 'Asap 12 jam ke depan (perkiraan)')}
      </h3>
      <p className="mt-1 leading-6 text-text-secondary">
        {reach
          ? tr(
              `Smoke at "Moderate" level or worse reaches about ${nf(reach.km, 0)} km towards the ${compass(reach.towardDeg)} by +12 h.`,
              `Asap level "Sedang" ke atas menjangkau sekitar ${nf(reach.km, 0)} km ke arah ${compass(reach.towardDeg)} pada +12 jam.`,
            )
          : tr('The smoke stays thin (below "Moderate") in this run.', 'Asap tetap tipis (di bawah "Sedang") pada simulasi ini.')}{' '}
        {model.hourly
          ? tr('It follows the hourly wind forecast.', 'Arahnya mengikuti prakiraan angin per jam.')
          : tr('It uses the same steady wind as the fire simulation.', 'Arahnya memakai angin tetap yang sama dengan simulasi api.')}
      </p>

      {hit.length > 0 ? (
        <ul className="mt-2 divide-y divide-line-dark overflow-hidden rounded-[8px] bg-black/20">
          {shown.map((x) => {
            const lvl = ispuOf(x.peak);
            const now = x.series[Math.min(step, x.series.length - 1)];
            return (
              <li key={`${x.kind}-${x.name}`} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {x.kind === 'city' ? tr(`${x.name} (city)`, `Kota ${x.name}`) : x.name}
                    <span className="num ml-1 text-xs font-normal text-text-muted">{nf(x.distanceKm, 0)} km</span>
                  </span>
                  <span className="num block text-xs leading-5 text-text-secondary">
                    {x.noticeableStep !== null && tr(`Smoke from ${stepToClock(x.noticeableStep + 1)}`, `Asap mulai ${stepToClock(x.noticeableStep + 1)}`)}
                    {x.unhealthyStep !== null && tr(`, unhealthy from ${stepToClock(x.unhealthyStep + 1)}`, `, tidak sehat mulai ${stepToClock(x.unhealthyStep + 1)}`)}
                    {tr(`. Peak ±${nfRough(x.peak)} µg/m³ at ${stepToClock(x.peakStep + 1)}.`, `. Puncak ±${nfRough(x.peak)} µg/m³ pukul ${stepToClock(x.peakStep + 1)}.`)}
                  </span>
                  <span className="num block text-xs text-text-muted">
                    {tr(`At ${stepToClock(step)}: `, `Pada ${stepToClock(step)}: `)}
                    {now > SMOKE_THRESHOLDS.sedang ? `±${nfRough(now)} µg/m³ (${ispuOf(now).label})` : tr('clear', 'bersih')}
                  </span>
                </span>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 px-2 py-0.5 text-xs font-semibold" style={{ color: lvl.ink }}>
                  <span className="size-2 rounded-full" style={{ background: lvl.color }} />
                  {lvl.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-text-secondary">
          {tr('No village or nearby city gets smoke above "Moderate" within 12 h.', 'Tidak ada desa atau kota sekitar yang terkena asap di atas level "Sedang" dalam 12 jam.')}
        </p>
      )}
      {hit.length > 6 && (
        <button onClick={() => setOpen(!open)} className="mt-2 text-xs font-semibold text-wind underline-offset-4 hover:underline">
          {open ? tr('Show fewer', 'Tampilkan lebih sedikit') : tr(`Show all ${hit.length}`, `Tampilkan semua ${hit.length}`)}
        </button>
      )}

      {unhealthyVillages.length > 0 && (
        <p className="mt-2 rounded-[8px] bg-warn/10 px-3 py-2 text-xs leading-5 text-text-secondary">
          <b className="text-text-primary">{tr('Prepare for smoke:', 'Siapkan menghadapi asap:')}</b>{' '}
          {tr(
            `N95/KN95 masks and a clean-air room (closed windows, air purifier) for ${unhealthyVillages.map((v) => v.name).join(', ')}. Prioritise babies, the elderly, pregnant women and people with asthma.`,
            `Masker N95/KN95 dan ruang udara bersih (jendela tertutup, penjernih udara) untuk ${unhealthyVillages.map((v) => v.name).join(', ')}. Utamakan bayi, lansia, ibu hamil, dan penderita asma.`,
          )}
        </p>
      )}
      <p className="mt-2 text-xs leading-5 text-text-muted">
        {tr(
          'Gaussian-puff model: PM2.5 from the simulated burning area (peat 17.3 g/kg, forest 9.1 g/kg), carried by the wind and mixed in a lower layer at night. Smoke from other fires and city pollution is not included. Order-of-magnitude estimate, not an official air-quality forecast.',
          'Model gumpalan Gaussian: PM2.5 dari area terbakar hasil simulasi (gambut 17,3 g/kg, hutan 9,1 g/kg), terbawa angin dan tertahan di lapisan rendah pada malam hari. Asap dari kebakaran lain dan polusi kota tidak dihitung. Perkiraan orde besaran, bukan prakiraan kualitas udara resmi.',
        )}
      </p>
    </section>
  );
}

/* ---------------- Tab: Dampak ---------------- */
function ImpactTab({ onFocusVillage }: { onFocusVillage: (name: string) => void }) {
  const s = useSim();
  const base = s.baseline!;
  const main = s.withBreak ?? base;
  const t = s.timeStep;
  const nowHours = (t * STEP_MINUTES) / 60;
  const villages = [...main.villageRisks].sort((a, b) => (a.etaHours ?? 99) - (b.etaHours ?? 99));
  const first = villages.find((v) => v.etaHours !== null);
  const baseVill = new Map(base.villageRisks.map((v) => [v.villageName, v]));
  const pop = new Map((s.scenario?.villages ?? []).map((v) => [v.name, v.population]));
  const km2Now = main.burnedByStep[Math.min(t, main.burnedByStep.length - 1)] ?? 0;
  const label = s.appliedRank ? BREAK_LABELS[s.appliedRank - 1] : null;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[34px] font-bold leading-none tracking-tight">
          <LiveNumber value={`${nf(main.burnedKm2)} km²`} />
        </p>
        <h2 className="mt-2 text-[15px] font-semibold leading-6">
          {tr('estimated area burned in 12 h,', 'perkiraan area terbakar dalam 12 jam,')}{' '}
          {s.withBreak ? tr(`with Firebreak ${label}`, `dengan Sekat ${label}`) : tr('no firebreak', 'tanpa sekat')}
        </h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {first
            ? tr(
                `${first.villageName} is reached first, in about ${nf(first.etaHours ?? 0)} h.`,
                `${first.villageName} terjangkau paling dulu, sekitar ${nf(first.etaHours ?? 0)} jam dari sekarang.`,
              )
            : tr('No village is reached by the fire within 12 h.', 'Tidak ada desa yang terjangkau api dalam 12 jam.')}
          {s.withBreak && (
            <>
              {' '}
              {tr('No firebreak', 'Tanpa sekat')}: <span className="num">{nf(base.burnedKm2)} km²</span>.
            </>
          )}
        </p>
      </header>

      <div className="flex items-center justify-between rounded-[8px] bg-black/20 px-3 py-2.5 text-sm">
        <span className="text-text-secondary">
          {tr('Burned by', 'Sudah terbakar pada')} {stepToClock(t)}
        </span>
        <span className="num font-semibold">{nf(km2Now)} km²</span>
      </div>

      <CarbonCard main={main.carbon} base={s.withBreak ? base.carbon : null} />

      {s.smokeModel && <SmokeCard model={s.smokeModel} step={t} />}

      {main.edge && (
        <p className="rounded-[8px] bg-black/20 px-3 py-2.5 text-sm leading-6 text-text-secondary">
          <b className="text-text-primary">{tr('The fire reaches the edge of the simulation area', 'Api mencapai batas area simulasi')}</b>{' '}
          {tr(
            '(dashed line on the map). Fire outside the 16 x 16 km box is not counted, so the real spread may be larger.',
            '(garis putus-putus di peta). Di luar kotak 16 x 16 km api tidak dihitung, jadi sebaran nyata bisa lebih luas dari yang terlihat.',
          )}
        </p>
      )}

      <section aria-labelledby="desa-h">
        <h3 id="desa-h" className="mb-2 text-sm font-semibold text-text-secondary">
          {tr('Villages, first reached at the top', 'Desa, urut dari yang paling dulu terjangkau')}
        </h3>
        <ul className="divide-y divide-line-dark overflow-hidden rounded-[8px] bg-black/20">
          {villages.map((v) => {
            const arrived = v.etaHours !== null && v.etaHours <= nowHours;
            const b = baseVill.get(v.villageName);
            const changed = s.withBreak && b && b.etaHours !== v.etaHours;
            return (
              <li key={v.villageName}>
                <button
                  onClick={() => onFocusVillage(v.villageName)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{v.villageName}</span>
                    <span className="num block text-sm text-text-secondary">
                      {v.etaHours === null
                        ? tr('Fire does not arrive within 12 h', 'Api tidak sampai dalam 12 jam')
                        : tr(
                            `Fire arrives in ±${nf(v.etaHours)} h (at ${stepToClock((v.etaHours * 60) / STEP_MINUTES)})`,
                            `Api tiba ±${nf(v.etaHours)} jam (pukul ${stepToClock((v.etaHours * 60) / STEP_MINUTES)})`,
                          )}
                    </span>
                    <span className="num block text-xs text-text-muted">
                      {v.etaHours !== null &&
                        (arrived
                          ? tr(`At ${stepToClock(t)}: fire has arrived · `, `Pada ${stepToClock(t)}: api sudah tiba · `)
                          : tr(`At ${stepToClock(t)}: ${nf(v.etaHours - nowHours)} h to go · `, `Pada ${stepToClock(t)}: ${nf(v.etaHours - nowHours)} jam lagi · `))}
                      ±{(pop.get(v.villageName) ?? 0).toLocaleString(locale())} {tr('people', 'jiwa')} · {tr('chance', 'peluang')}{' '}
                      {Math.round(v.burnProbability * 100)}%
                    </span>
                    {changed && (
                      <span className="num block text-xs text-firebreak">
                        {tr('No firebreak', 'Tanpa sekat')}:{' '}
                        {b.etaHours === null ? tr('not reached', 'tidak terjangkau') : tr(`arrives in ${nf(b.etaHours)} h`, `tiba ${nf(b.etaHours)} jam`)}
                      </span>
                    )}
                  </span>
                  <StatusBadge level={v.level} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-text-muted">
          {LEVEL_RULES().map(([c, l, r]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: c }} />
              <b className="font-semibold text-text-secondary">{l}</b> {r}
            </span>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-text-muted">
        {tr(
          'Levels come from the estimated fire arrival time (average of 12 runs). Click a village to see it on the map.',
          'Level ditentukan dari perkiraan jam tiba api (rata-rata 12 kali simulasi). Klik desa untuk melihatnya di peta.',
        )}
      </p>
    </div>
  );
}

/* ---------------- Tab: Sekat bakar ---------------- */
function HowBreaksWork() {
  const items = [
    [tr('A firebreak', 'Sekat bakar'), tr('is a strip about 500 m wide cleared of fuel (and wetted on peat) so the fire stops.', 'adalah jalur selebar ±500 m yang dibersihkan dari bahan bakar (dan dibasahi di gambut) sehingga api berhenti.')],
    [tr('The app tests 225 lines', 'Sistem menguji 225 garis'), tr('ahead of the fire: 5 distances, 3 angles, 3 lengths, 5 offsets.', 'di depan arah sebaran api: 5 jarak, 3 sudut, 3 panjang, 5 posisi geser.')],
    [
      tr('Each line is simulated again', 'Tiap garis disimulasikan ulang'),
      tr(
        `and the three that cut the most damage and can still be built in time are kept (building takes ${FIREBREAK_BUILD_HOURS} h).`,
        `lalu dipilih tiga yang paling mengurangi kerusakan dan masih sempat dibangun (pembangunan dianggap ${FIREBREAK_BUILD_HOURS} jam).`,
      ),
    ],
    [tr('Only one firebreak is applied', 'Hanya satu sekat diterapkan'), tr('at a time. Choosing another replaces the previous one.', 'pada satu waktu. Memilih sekat lain menggantikan sekat sebelumnya.')],
  ];
  return (
    <ol className="space-y-2 text-sm leading-6 text-text-secondary">
      {items.map(([k, v], i) => (
        <li key={k} className="grid grid-cols-[22px_1fr] gap-1">
          <span className="num font-semibold text-text-primary">{i + 1}.</span>
          <span>
            <b className="text-text-primary">{k}</b> {v}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ScoreInfo() {
  return (
    <div className="rounded-[8px] bg-black/20 p-3 text-sm leading-6 text-text-secondary">
      <p className="font-semibold text-text-primary">{tr('How the 0–100 score is calculated', 'Cara skor 0–100 dihitung')}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>
          <b className="text-text-primary">{tr('Effectiveness', 'Efektivitas')}</b>:{' '}
          {tr(
            'how much the risk drops. Risk is weighted: settlements x100, plantations x10, peat x5, forest x3, shrub x1. A drop of 35% or more counts as full.',
            'seberapa besar risiko turun. Risiko diberi bobot: permukiman x100, kebun x10, gambut x5, hutan x3, semak x1. Penurunan 35% atau lebih dianggap penuh.',
          )}
        </li>
        <li>
          <b className="text-text-primary">{tr('Time factor', 'Faktor waktu')}</b>:{' '}
          {tr(
            `time left after ${FIREBREAK_BUILD_HOURS} h of building. 3 h or more left counts as full; tight timing reduces it to 40%.`,
            `sisa waktu setelah ${FIREBREAK_BUILD_HOURS} jam pembangunan. Sisa 3 jam atau lebih bernilai penuh; mepet dikurangi hingga 40%.`,
          )}
        </li>
        <li>
          <b className="text-text-primary">{tr('Length cost', 'Biaya panjang')}</b>: {tr('minus 1.5 points per km of firebreak.', 'dikurangi 1,5 poin per km sekat.')}
        </li>
      </ol>
      <p className="mt-1">{tr('Score = 100 x effectiveness x time factor − 1.5 x length (km).', 'Skor = 100 x efektivitas x faktor waktu − 1,5 x panjang (km).')}</p>
    </div>
  );
}

function BreakTab({
  onRecommend,
  onApply,
  onShowBreak,
}: {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onShowBreak: (rank: number) => void;
}) {
  const s = useSim();
  const [scoreInfo, setScoreInfo] = useState(false);
  const [how, setHow] = useState(false);
  const ready = s.baseline?.quality === 'refined';
  const best = s.recommendations[0];
  const ign = s.scenario ? ignitionPoint(s.scenario.grid, s.ignitions ?? s.scenario.ignitions) : null;
  const allPeat = s.recommendations.length > 1 && s.recommendations.every((r) => r.peatBypassRisk);

  if (s.recState === 'idle') {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{tr('Where does a firebreak work best?', 'Di mana sekat bakar paling efektif?')}</h2>
        <HowBreaksWork />
        <Button tone="dark" size="md" className="w-full" onClick={onRecommend} disabled={!ready} loading={!ready}>
          {tr('Find the best firebreaks', 'Cari sekat terbaik')}
        </Button>
      </div>
    );
  }

  if (s.recState === 'running') {
    const pct = Math.round(s.recProgress * 100);
    return (
      <div className="space-y-3" aria-live="polite">
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{tr('Testing firebreak lines...', 'Menguji garis sekat...')}</h2>
        <div className="h-2 overflow-hidden rounded-full bg-black/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#9be15d,#ffd24a)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <p className="num text-sm text-text-secondary">{tr(`${pct}% of 225 candidates`, `${pct}% dari 225 kandidat`)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        {best ? (
          <>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">
              {tr('Firebreak A cuts the burned area by', 'Sekat A memangkas')} <span className="num">{nf(best.reductionPct)}%</span>
              {tr('', ' area terbakar')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              {tr(
                `The three best of ${s.recCandidates} lines tested. Pick one to apply; the map flies to it.`,
                `Tiga lokasi terbaik dari ${s.recCandidates} garis yang diuji. Pilih satu untuk diterapkan; peta langsung menuju sekat itu.`,
              )}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold leading-tight tracking-tight">{tr('No firebreak can be built in time', 'Tidak ada sekat yang sempat dibangun')}</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">{s.recEmptyReason}</p>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button onClick={() => setHow(!how)} aria-expanded={how} className="font-semibold text-sun underline-offset-4 hover:underline">
            {how ? tr('Hide explanation', 'Tutup penjelasan') : tr('How are firebreaks chosen?', 'Bagaimana sekat dipilih?')}
          </button>
          <button
            onClick={() => setScoreInfo(!scoreInfo)}
            aria-expanded={scoreInfo}
            className="inline-flex items-center gap-1 font-semibold text-sun underline-offset-4 hover:underline"
          >
            <IconInfo size={15} /> {tr('What the score means', 'Arti skor')}
          </button>
        </div>
      </header>
      {how && <HowBreaksWork />}
      {scoreInfo && <ScoreInfo />}

      {s.recState === 'stale' && (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-black/20 p-3 text-sm">
          <span className="text-text-secondary">{tr('Conditions changed since the firebreaks were calculated.', 'Kondisi berubah sejak sekat dihitung.')}</span>
          <Button tone="dark" variant="secondary" size="sm" onClick={onRecommend}>
            {tr('Recalculate', 'Hitung ulang')}
          </Button>
        </div>
      )}

      {allPeat && (
        <p className="rounded-[8px] bg-black/20 px-3 py-2.5 text-sm leading-6 text-text-secondary">
          {tr('All three firebreaks cross', 'Ketiga sekat melintasi')} <b className="text-text-primary">{tr('dry peat', 'gambut kering')}</b>
          {tr(
            ': add rewetting or canal blocking so the underground fire does not slip through.',
            ': sertakan pembasahan atau sekat kanal agar api bawah tanah tidak lolos.',
          )}
        </p>
      )}

      <ul className="space-y-2">
        {s.recommendations.map((r) => {
          const applied = s.appliedRank === r.rank;
          const active = s.activeRank === r.rank;
          const L = BREAK_LABELS[r.rank - 1];
          const color = BREAK_COLORS[r.rank - 1];
          const d = ign && s.scenario ? describeBreak(r.line.coordinates, ign, s.scenario.villages) : null;
          return (
            <li key={r.rank} id={`sekat-card-${r.rank}`} className="scroll-mt-16">
              <article
                onMouseEnter={() => s.appliedRank === null && s.set({ activeRank: r.rank })}
                aria-label={tr(`Firebreak ${L}`, `Sekat ${L}`)}
                className={`overflow-hidden rounded-[8px] border-l-4 p-3 transition-colors ${applied ? 'bg-bg-hover' : active ? 'bg-white/5' : 'bg-black/20'}`}
                style={{ borderLeftColor: color }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">
                    <span style={{ color }}>{tr(`Firebreak ${L}`, `Sekat ${L}`)}</span>
                    {applied && (
                      <span className="ml-2 inline-flex items-center gap-1 text-sm font-semibold text-firebreak">
                        <IconCheck size={14} /> {tr('Applied', 'Diterapkan')}
                      </span>
                    )}
                  </h3>
                  <span className="num text-sm text-text-secondary">
                    {tr('score', 'skor')} {nf(r.score, 0)}/100
                  </span>
                </div>
                {d && <p className="mt-1 text-sm leading-6 text-text-secondary">{breakSentence(d)}</p>}
                {d && (
                  <dl className="num mt-2 space-y-0.5 rounded-[6px] bg-black/20 px-2.5 py-2 text-xs leading-5">
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-text-muted">
                        {tr('From', 'Dari')} {L}1
                      </dt>
                      <dd>{fmtCoord(d.from[0], d.from[1])}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-text-muted">
                        {tr('To', 'Ke')} {L}2
                      </dt>
                      <dd>{fmtCoord(d.to[0], d.to[1])}</dd>
                    </div>
                  </dl>
                )}
                <dl className="num mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-text-muted">{tr('Area burned', 'Area terbakar')}</dt>
                    <dd className="font-semibold">−{nf(r.reductionPct)}%</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{tr('Done within', 'Selesai dalam')}</dt>
                    <dd className="font-semibold">{tr(`${nf(r.marginHours + FIREBREAK_BUILD_HOURS)} h`, `${nf(r.marginHours + FIREBREAK_BUILD_HOURS)} jam`)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{tr('Length x width', 'Panjang x lebar')}</dt>
                    <dd className="font-semibold">
                      {nf(r.lengthKm)} km x {r.widthM} m
                    </dd>
                  </div>
                </dl>
                {r.peatBypassRisk && !allPeat && (
                  <p className="mt-2 text-sm leading-5 text-text-secondary">
                    {tr('Crosses dry peat: add rewetting or canal blocking.', 'Melintasi gambut kering: sertakan pembasahan atau sekat kanal.')}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {applied ? (
                    <Button tone="dark" variant="secondary" size="sm" className="flex-1" onClick={() => onApply(null)}>
                      <IconUndo size={16} /> {tr('Undo', 'Batalkan')}
                    </Button>
                  ) : (
                    <Button
                      tone="dark"
                      variant={r.rank === 1 && s.appliedRank === null ? 'primary' : 'secondary'}
                      size="sm"
                      className="flex-1"
                      onClick={() => onApply(r.rank)}
                    >
                      {s.appliedRank !== null ? tr(`Switch to Firebreak ${L}`, `Ganti ke Sekat ${L}`) : tr(`Apply Firebreak ${L}`, `Terapkan Sekat ${L}`)}
                    </Button>
                  )}
                  <Button tone="dark" variant="ghost" size="sm" onClick={() => onShowBreak(r.rank)} aria-label={tr(`Show Firebreak ${L} on the map`, `Lihat Sekat ${L} di peta`)}>
                    <IconPin size={16} /> {tr('Show on map', 'Lihat di peta')}
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {s.appliedRank !== null && (
        <div className="rounded-[8px] bg-black/20 px-3">
          <Switch
            checked={s.compare}
            onChange={(v) => s.set({ compare: v })}
            label={
              <span className="inline-flex items-center gap-2 font-semibold">
                <IconSplit size={16} /> {tr('Compare side by side', 'Bandingkan berdampingan')}
              </span>
            }
            hint={tr('Left map without the firebreak, right with it', 'Peta kiri tanpa sekat, kanan dengan sekat')}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------- Tab: Briefing & laporan ---------------- */
const HEADS: Record<string, 'situ' | 'prio' | 'note'> = {
  SITUASI: 'situ',
  SITUATION: 'situ',
  'PRIORITAS TINDAKAN': 'prio',
  'PRIORITY ACTIONS': 'prio',
  CATATAN: 'note',
  NOTES: 'note',
  NOTE: 'note',
};

function parseBriefing(text: string) {
  const blocks: { title: string; lines: string[] }[] = [];
  let cur: { title: string; lines: string[] } | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!line) continue;
    const head = line.replace(/:$/, '').toUpperCase();
    if (HEADS[head]) {
      cur = { title: HEADS[head], lines: [] };
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
    else blocks.push((cur = { title: '', lines: [line] }));
  }
  return blocks;
}

function BriefTab({ onBriefing, onSave, saving }: { onBriefing: () => void; onSave: () => void; saving: boolean }) {
  const s = useSim();
  const ready = s.baseline?.quality === 'refined';
  const blocks = s.briefing ? parseBriefing(s.briefing.text) : [];
  const ign = s.scenario ? ignitionPoint(s.scenario.grid, s.ignitions ?? s.scenario.ignitions) : null;
  const label = s.appliedRank ? BREAK_LABELS[s.appliedRank - 1] : null;
  const situ = blocks.find((b) => b.title === 'situ');
  const prio = blocks.find((b) => b.title === 'prio');
  const note = blocks.find((b) => b.title === 'note');
  const other = blocks.filter((b) => !b.title);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{tr('Briefing for the command post', 'Briefing untuk posko')}</h2>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {tr(
            `Gemini reads this simulation (ignition point, villages, arrival times${s.recommendations.length ? ', firebreak coordinates' : ''}) and writes specific actions for this place.`,
            `Gemini membaca hasil simulasi ini (titik api, desa, jam tiba${s.recommendations.length ? ', koordinat sekat' : ''}) dan menyusun tindakan spesifik untuk lokasi ini.`,
          )}
        </p>
      </header>

      {/* Angka kunci: selalu jelas tanpa/dengan sekat */}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-[8px] bg-black/20 p-3">
          <dt className="text-xs text-text-muted">{tr('Burned without a firebreak', 'Luas terbakar tanpa sekat')}</dt>
          <dd className="num mt-0.5 text-lg font-semibold">{nf(s.baseline?.burnedKm2 ?? 0)} km²</dd>
        </div>
        <div className="rounded-[8px] bg-black/20 p-3">
          <dt className="text-xs text-text-muted">{label ? tr(`With Firebreak ${label}`, `Dengan Sekat ${label}`) : tr('With a firebreak', 'Dengan sekat')}</dt>
          <dd className="num mt-0.5 text-lg font-semibold">{s.withBreak ? `${nf(s.withBreak.burnedKm2)} km²` : tr('Not applied yet', 'Belum diterapkan')}</dd>
        </div>
        {ign && (
          <div className="col-span-2 rounded-[8px] bg-black/20 p-3">
            <dt className="text-xs text-text-muted">{tr('Ignition point', 'Titik awal api')}</dt>
            <dd className="num mt-0.5 font-semibold">{fmtCoord(ign[0], ign[1])}</dd>
          </div>
        )}
      </dl>

      {!s.briefing && (
        <Button tone="dark" className="w-full" onClick={onBriefing} disabled={!ready} loading={s.briefingState === 'loading'}>
          {s.briefingState === 'loading' ? tr('Writing the briefing...', 'Menyusun briefing...') : tr('Write the briefing', 'Susun briefing')}
        </Button>
      )}
      {s.briefingState === 'error' && <p className="text-sm text-danger-ink">{tr('The briefing failed. Try again.', 'Briefing gagal disusun. Coba lagi.')}</p>}

      {s.briefing && (
        <div className="space-y-3" aria-live="polite">
          {[...other, ...(situ ? [situ] : [])].map((b, i) => (
            <section key={i} className="rounded-[12px] bg-black/20 p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-sun">{tr('Situation', 'Situasi')}</h3>
              {b.lines.map((l, k) => (
                <p key={k} className="text-[15px] leading-7">
                  {l}
                </p>
              ))}
            </section>
          ))}
          {prio && (
            <section className="rounded-[12px] bg-black/20 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sun">{tr('Do now, in order', 'Lakukan sekarang, berurutan')}</h3>
              <ol className="space-y-2.5">
                {prio.lines.map((l, k) => (
                  <li key={k} className="grid grid-cols-[26px_1fr] gap-2 text-[15px] leading-6">
                    <span className="num grad-sun grid size-6 place-items-center rounded-full text-xs font-bold">{k + 1}</span>
                    <span>{l.replace(/^[-*]\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {note && <p className="px-1 text-sm leading-6 text-text-muted">{note.lines.join(' ')}</p>}
          <p className="px-1 text-xs text-text-muted">
            {s.briefing.source === 'gemini'
              ? tr(`Written by ${s.briefing.model}`, `Disusun oleh ${s.briefing.model}`)
              : tr('Written with fixed rules (Gemini unavailable)', 'Disusun dengan aturan tetap (Gemini tidak tersedia)')}
            . {tr('The briefing is cleared when conditions change.', 'Briefing otomatis dihapus bila kondisi berubah.')}
          </p>
        </div>
      )}

      <div className="border-t border-line-dark pt-5">
        <h3 className="text-[15px] font-semibold">{tr('Share with BPBD', 'Bagikan ke BPBD')}</h3>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          {tr('Save this result as a report that can be printed and shared by link.', 'Simpan hasil ini sebagai laporan yang bisa dicetak dan dibagikan lewat tautan.')}
        </p>
        {s.slug === 'live' ? (
          <p className="mt-2 rounded-[8px] bg-black/20 px-3 py-2.5 text-sm leading-6 text-text-secondary">
            {tr(
              'Printed reports are available for the sample areas. For a live hotspot, share the briefing above or copy the dispatch orders from the Response tab.',
              'Laporan cetak saat ini tersedia untuk wilayah contoh. Untuk lokasi titik panas langsung, bagikan briefing di atas atau salin perintah pengerahan dari tab Respons.',
            )}
          </p>
        ) : (
          <Button tone="dark" variant={s.briefing ? 'primary' : 'secondary'} className="mt-3 w-full" onClick={onSave} disabled={!ready} loading={saving}>
            {saving ? tr('Saving the report...', 'Menyimpan laporan...') : tr('Save report', 'Simpan laporan')}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Panel hasil bertab ---------------- */
interface Props {
  onRecommend: () => void;
  onApply: (rank: number | null) => void;
  onShowBreak: (rank: number) => void;
  onFocusVillage: (name: string) => void;
  onBriefing: () => void;
  onSave: () => void;
  saving: boolean;
  hideTabs?: boolean;
  planSet: PlanSet | null;
  plan: ResponsePlan | null;
  onRefreshHotspots: () => void;
  refreshingHotspots: boolean;
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-4" aria-label={tr('Loading results', 'Memuat hasil')} role="status">
      <div className="skeleton h-9 w-40 rounded-md" />
      <div className="skeleton h-4 w-56 rounded" />
      <div className="skeleton h-11 w-full rounded-[8px]" />
      <div className="skeleton h-48 w-full rounded-[8px]" />
      <span className="sr-only">{tr('Calculating 12 hours of fire spread', 'Menghitung sebaran api 12 jam')}</span>
    </div>
  );
}

export default function ResultsPanel(props: Props) {
  const tab = useSim((s) => s.tab);
  const set = useSim((s) => s.set);
  const has = useSim((s) => s.baseline !== null);
  const recCount = useSim((s) => s.recommendations.length);
  return (
    <div>
      {!props.hideTabs && (
        <Segmented
          label={tr('Results section', 'Bagian hasil')}
          value={tab}
          onChange={(v) => set({ tab: v })}
          options={[
            { value: 'dampak', label: tr('Impact', 'Dampak') },
            { value: 'sekat', label: recCount ? tr(`Breaks (${recCount})`, `Sekat (${recCount})`) : tr('Breaks', 'Sekat') },
            { value: 'respons', label: tr('Response', 'Respons') },
            { value: 'briefing', label: 'Briefing' },
          ]}
          className="mb-5"
        />
      )}
      {!has ? (
        <ResultsSkeleton />
      ) : tab === 'dampak' ? (
        <ImpactTab onFocusVillage={props.onFocusVillage} />
      ) : tab === 'sekat' ? (
        <BreakTab onRecommend={props.onRecommend} onApply={props.onApply} onShowBreak={props.onShowBreak} />
      ) : tab === 'respons' ? (
        <ResponseTab set={props.planSet} plan={props.plan} onRefreshHotspots={props.onRefreshHotspots} refreshing={props.refreshingHotspots} />
      ) : (
        <BriefTab onBriefing={props.onBriefing} onSave={props.onSave} saving={props.saving} />
      )}
    </div>
  );
}
