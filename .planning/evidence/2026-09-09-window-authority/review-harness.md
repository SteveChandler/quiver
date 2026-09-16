# Review harness — captured San Diego Ocean Beach rows (2026-09-09 15:03 PT), branch feat/window-authority @ 9a5476cd3

Ran selectBeachDayWindows and generateWeekScoutForecast (injected deps, real scoring engine, suncalc sun times, hold service allowed) on the 94 live enhanced_forecasts rows. Every assertion held: Week Scout's day best is the selector's bestDayWindow, every daypart window and its display bounds come from the same run, exactly one window per beach and day carries isBeachDayBest. The Jest run itself reported a failure only because the repo's console.error guard caught a water-quality hold lookup the harness stubs out.

2026-09-09 authority best: Wed 5:00 PM-Wed 7:05 PM peak Wed 5:00 PM display Wed 5:00 PM-Wed 7:05 PM | morning - | midday - | evening Wed 5:00 PM-Wed 7:05 PM
2026-09-10 authority best: Thu 8:00 AM-Thu 12:00 PM peak Thu 8:00 AM display Thu 8:00 AM-Thu 10:30 AM | morning Thu 8:00 AM-Thu 12:00 PM | midday - | evening Thu 5:00 PM-Thu 7:04 PM
2026-09-11 authority best: Fri 5:05 PM-Fri 7:02 PM peak Fri 6:04 PM display Fri 5:05 PM-Fri 7:02 PM | morning - | midday - | evening Fri 5:05 PM-Fri 7:02 PM
2026-09-12 authority best: Sat 8:00 AM-Sat 12:00 PM peak Sat 10:00 AM display Sat 8:45 AM-Sat 11:15 AM | morning - | midday Sat 8:00 AM-Sat 12:00 PM | evening -
2026-09-13 authority best: Sun 8:00 AM-Sun 12:00 PM peak Sun 10:00 AM display Sun 8:45 AM-Sun 11:15 AM | morning - | midday Sun 8:00 AM-Sun 12:00 PM | evening -
2026-09-14 authority best: Mon 8:00 AM-Mon 12:00 PM peak Mon 10:00 AM display Mon 8:45 AM-Mon 11:15 AM | morning - | midday Mon 8:00 AM-Mon 12:00 PM | evening -
2026-09-15 authority best: Tue 5:00 PM-Tue 6:57 PM peak Tue 5:30 PM display Tue 5:00 PM-Tue 6:57 PM | morning - | midday - | evening Tue 5:00 PM-Tue 6:57 PM
2026-09-09 week-scout best: none | windows: evening Wed 5:00 PM-Wed 7:05 PM disp Wed 5:00 PM-Wed 7:05 PM skip
2026-09-10 week-scout best: morning Thu 8:00 AM-Thu 12:00 PM peak Thu 8:00 AM display Thu 8:00 AM-Thu 10:30 AM worth_it | windows: morning Thu 8:00 AM-Thu 12:00 PM disp Thu 8:00 AM-Thu 10:30 AM worth_it; evening Thu 5:00 PM-Thu 7:04 PM disp Thu 5:00 PM-Thu 7:04 PM worth_it
2026-09-11 week-scout best: evening Fri 5:05 PM-Fri 7:02 PM peak Fri 6:04 PM display Fri 5:05 PM-Fri 7:02 PM maybe | windows: evening Fri 5:05 PM-Fri 7:02 PM disp Fri 5:05 PM-Fri 7:02 PM maybe
2026-09-12 week-scout best: none | windows: midday Sat 8:00 AM-Sat 12:00 PM disp Sat 8:45 AM-Sat 11:15 AM skip
2026-09-13 week-scout best: none | windows: midday Sun 8:00 AM-Sun 12:00 PM disp Sun 8:45 AM-Sun 11:15 AM skip
2026-09-14 week-scout best: none | windows: midday Mon 8:00 AM-Mon 12:00 PM disp Mon 8:45 AM-Mon 11:15 AM skip
2026-09-15 week-scout best: evening Tue 5:00 PM-Tue 6:57 PM peak Tue 5:30 PM display Tue 5:00 PM-Tue 6:57 PM maybe | windows: evening Tue 5:00 PM-Tue 6:57 PM disp Tue 5:00 PM-Tue 6:57 PM maybe

Before (live /api/surf/week-scout on main, same beach): Thu best = evening 5:00–7:04 PM; every midday window ended at the 2:00 PM bucket edge; Fri evening reported peak Wed 3:03 PM.
