-- Fill editorial prose for beaches across CA, HI, OR, WA.
-- Safe: only updates rows WHERE best_conditions_prose IS NULL OR empty.
-- Idempotent: re-running changes nothing once prose is set.

BEGIN;

-- =============================================
-- SOUTHERN CALIFORNIA (14 beaches)
-- =============================================

-- T-Street (San Clemente)
UPDATE beaches SET
  best_conditions_prose = 'Works on any swell direction from S to W (160-300°), but best on a clean SW groundswell in the 3-6 ft range. Mid-tide on the incoming keeps the cobblestone reef sections from getting too shallow. Light NE offshores groom the faces. October is statistically the best month—54% clean surfable days—but T-Street produces rideable waves year-round when the rest of OC is flat.',
  wave_tips = 'A boulder-and-sand bottom beach break that shifts personality mid-wave—it can go from mellow San O'' cruiser to a fast, ledgy inside section in one bottom turn. Lefts off the reef are longer and more defined on south swells; rights dominate on winter NW energy. The inside rock shelf creates a bowling section that rewards committed surfers. Shortboard is the default, but a mid-length works well on smaller days.',
  crowd_tips = 'Crowded year-round, especially summer when it''s blackballed 11am-6pm (10am-6pm weekends). Dawn patrol is the move. The reef, Cropley''s, and Beach House sections spread the crowd somewhat. Street parking on Trafalgar and surrounding streets fills early on good days.'
WHERE name = 'T-Street' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- The Wedge (Newport Beach)
UPDATE beaches SET
  best_conditions_prose = 'Needs a solid S-SSW swell (180-220°) to create the jetty-reflected constructive interference that makes this spot unique. Best at 4-10+ ft on a mid to high incoming tide. Light N-NE winds or glassy conditions are essential—any onshore texture kills the shape. Peak season is June through September when Southern Hemisphere groundswells march in. The bigger the south swell, the more violent the wedging effect.',
  wave_tips = 'Not a traditional surf wave—it''s a mutant shorebreak where the incoming swell reflects off the Newport Harbor jetty and collides with the next wave, doubling up into 20-30 ft faces detonating in 2-3 ft of water. The left is the main event: a steep, wedging drop into a massive barrel that slams onto hard-packed sand. Bodysurfing and bodyboarding are the primary crafts. Board surfing is possible but extremely dangerous. This is a spectacle wave with real consequences—broken necks and spinal injuries are not uncommon.',
  crowd_tips = 'Draws huge spectator crowds on big south swells. In the water, maybe 10-30 bodysurfers and bodyboarders competing for position. Boards are blackballed 10am-5pm in summer. The vibe is intense—everyone out here knows the risks. Parking at the end of Balboa Peninsula fills fast; arrive before 7am on a pumping swell.'
WHERE name = 'The Wedge' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Doheny State Beach (Dana Point)
UPDATE beaches SET
  best_conditions_prose = 'Best on a S-SW swell (180-220°) in the 2-4 ft range at high tide. The south-facing orientation means summer swells are the primary season—this is when Doheny comes alive. Larger winter W-NW swells can push 4-6 ft faces but the wave gets disorganized. Light NE winds or glassy conditions. The harbor jetty blocks a lot of swell energy, so it takes more size than you''d expect to get it working.',
  wave_tips = 'A gentle cobblestone-bottom break that peels slowly and predictably—the quintessential California longboard wave. The takeoff is soft and forgiving, building gradually as it rolls over the cobble shelf. Rights are the primary ride, peeling toward the jetty with enough shoulder for cross-stepping and noserides. One of Orange County''s best learning waves, but experienced longboarders will find it rewarding on the right day too.',
  crowd_tips = 'Very crowded in summer with surf schools, beginners, and families. The parking lot is inside the state park ($15/day weekday, $20/day summer weekends). Dawn patrol avoids the worst crowds. Water quality degrades significantly after rain due to San Juan Creek runoff—check county advisories before paddling out.'
WHERE name = 'Doheny State Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Malibu First Point (Surfrider)
UPDATE beaches SET
  best_conditions_prose = 'Best on a clean S-SW swell (180-240°) in the 3-6 ft range, though it also handles large W-NW swells that wrap around the point. Mid-tide on the incoming produces the most makeable walls. Light N offshore winds or calm conditions—the canyon funnels any breeze straight into the lineup. Late summer through fall is prime when south swells combine with Santa Ana offshores. On a big combo swell, the three points can connect for rides over a quarter mile.',
  wave_tips = 'A world-class right point break over cobblestone that produces long, perfectly tapered walls ideal for trimming and noserides. First Point is the inside section—slower, more forgiving, and favored by longboarders. Second Point offers steeper drops and more performance potential. On rare days, Third Point connects all the way through. The wave is mechanical and predictable, which is exactly what makes it so addictive. Longboard or mid-length is the weapon of choice.',
  crowd_tips = 'One of the most crowded waves on the planet. Expect 50-100+ surfers on any rideable day. First light offers slightly thinner crowds but you''ll still be sharing every wave. The locals are skilled and will outposition visitors on every set wave. Respect the pecking order. Paid parking in the Surfrider lot fills by 7am on weekends; overflow along PCH gets ticketed aggressively.'
WHERE name = 'Malibu First Point (Surfrider)' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Rincon (Carpinteria)
UPDATE beaches SET
  best_conditions_prose = 'Needs a solid W-NW swell (260-310°) in the 4-8 ft range to light up properly. Swells funnel through the gap between the Channel Islands and Point Conception and wrap perfectly around the point. Low to mid-tide is prime—all three sections improve as the tide drops, and tube sections appear at low tide. Light E-NE offshores are essential. November through March is the season; December and January are peak months for the biggest, most consistent energy.',
  wave_tips = 'A world-class right point break divided into three sections. The Indicator sits at the top of the point—long, mellow walls for longboarders. The Rivermouth is the middle link—unpredictable and occasionally hollow, but polluted after rain. The Cove is the crown jewel: a fast, perfectly shaped right that can run 300 yards on a solid swell. On an epic day, all three sections connect into one of the longest rides in California. Cobblestone bottom. Shortboard or performance mid-length for the Cove; logs for the Indicator.',
  crowd_tips = 'Notoriously crowded—150-200+ surfers on a good winter swell. It''s visible from Highway 101 so every passing surfer knows when it''s on. The Cove draws the heaviest competition for waves. Parking is limited along the highway pullouts and fills fast. Dawn patrol is essential but even then expect 30-50 surfers. The vibe can be intense at the Cove; the Indicator is more welcoming.'
WHERE name = 'Rincon' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- HB Cliffs (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'Works on a wide swell window—anything from S to WNW (180-300°)—but best on a clean W-SW swell in the 3-5 ft range. Low to mid-tide produces the best-shaped peaks. NE offshore winds clean it up, but the open beach exposure means any wind texture shows immediately. January is statistically the best month for clean surf. Summer offers more consistent small surf but quality drops.',
  wave_tips = 'A soft, forgiving beach break with shifting sandbars that produce both lefts and rights. The waves lack the punch of HB Pier or Newport—it''s generally slower and mushier, which actually makes it a solid option for progressing intermediates. On a combo swell with some south in it, the peaks get more defined and the rights can offer fun, rippable walls. Walk the cliffs to spot the best-forming sandbars before paddling out.',
  crowd_tips = 'Very crowded, especially summer weekends when the dog beach parking lot overflows. The cliffs above provide a good vantage point—use them to time your paddle-out. Dawn patrol thins the crowd significantly. Parking along Pacific Coast Highway and in the lots can be competitive; the dog beach lot fills fastest.'
WHERE name = 'HB Cliffs' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Hermosa Pier (Hermosa Beach)
UPDATE beaches SET
  best_conditions_prose = 'Best on a SW-W swell (200-270°) in the 3-6 ft range with NE-E offshore winds. A rising mid-tide (3-4 ft) fills in the sandbars around the pier pilings and produces the most workable peaks. Winter NW swells provide the most power, but combo swells with some south energy create better shape. Glassy early mornings are key—afternoon onshores blow it out consistently.',
  wave_tips = 'A pier break producing lefts and rights that shift with the sandbars around the pilings. The south side tends to be more consistent but the north can produce longer walls when the sand cooperates. Waves have more push than the surrounding open beach breaks due to the pier''s sand-trapping effect. On overhead days, the takeoff tightens up and the drops get steep. Stay aware of the pilings—getting swept into them on a set wave is a real hazard. Shortboard or fish for most conditions.',
  crowd_tips = 'Very crowded, especially within 50 yards of the pier where the best banks form. The Strand bike path brings constant spectators. Dawn patrol and weekday evenings are your best windows. Metered street parking along Hermosa Ave and the pier lot both fill early. The local crew surfs here daily and knows exactly where the sandbars are shifting.'
WHERE name = 'Hermosa Pier' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Newport Lower Jetties (Newport Beach)
UPDATE beaches SET
  best_conditions_prose = 'Best on a S-SSW swell (180-210°) in the 3-5 ft range, though it handles a wide window from SE to WNW. Low to mid-tide on the incoming creates the most defined peaks. NE offshores or calm glassy mornings are ideal. Summer south swells are the primary season, but winter combo swells with some south energy can produce surprisingly fun sessions.',
  wave_tips = 'A playful, forgiving beach break that''s mellower and more user-friendly than the upper jetties or Blackies to the north. Sandbars shift with the seasons but generally produce both lefts and rights with enough shoulder to work. Not a power wave—it''s more about finding the right peak and making the most of a fun, zippy wall. On a good combo or tropical swell, it punches above its weight. Shortboard, fish, or mid-length all work depending on size.',
  crowd_tips = 'Less competitive than 28th Street, Blackies, or the pier area, which is part of the appeal. Still crowded on summer weekends but the peaks spread out enough to find space. The 36th Street area is a good bet for fewer surfers. Street parking along the Balboa Peninsula; metered and competitive in summer.'
WHERE name = 'Newport Lower Jetties' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- San Clemente Pier, Northside
UPDATE beaches SET
  best_conditions_prose = 'Best on a SW swell (200-250°) in the 3-6 ft range, but also handles winter NW energy that wraps in. Mid to high incoming tide (3-5 ft) keeps the inside from getting too shallow. NE offshores. Combo swells with both S and W energy produce the best-shaped peaks. October is statistically the cleanest month. Works year-round but summer south swells and fall combo swells are prime.',
  wave_tips = 'A pier break producing mainly lefts off the north side of the pier, with occasional rights toward it. The pier pilings trap sand and create more defined banks than the open beach on either side. The lefts can wall up nicely and offer 50-75 yard rides on a good swell. The wave is average most days—lumpy and sectiony—but on the right combo swell it can get genuinely fun. Stay clear of the pilings on bigger sets. Shortboard or performance fish.',
  crowd_tips = 'Very crowded, especially mornings when the local high school surf team trains here. The pier area is a magnet for everyone from groms to retirees. Paid parking at the pier lot or metered street spots along Avenida Del Mar. Dawn patrol helps but the northside peak is small enough that even 10 surfers feels packed.'
WHERE name = 'San Clemente Pier, Northside' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- 204s (San Clemente)
UPDATE beaches SET
  best_conditions_prose = 'Best on a SSW swell (190-230°) in the 3-5 ft range at a rising mid-tide. Clean groundswells produce better shape than windswells. NE offshores. Summer is the most consistent season when south swells line up. Also handles winter W-NW energy but can get closed out on straight NW swells over 5 ft.',
  wave_tips = 'An exposed beach break over sand and rock reef producing both lefts and rights. Often looks better from the bluff than it actually is—the peaks can be sectiony and short-lived. When the sandbars cooperate and the swell angle is right, there are fun, rippable walls with some punch from the reef underneath. Not a destination wave, but a solid local option when the marquee SC spots are too crowded. Shortboard or fish.',
  crowd_tips = 'Typically less crowded than T-Street or the pier, which is the main draw. On a clean summer south swell, expect 10-20 surfers spread across the peaks. Street parking on Dije Court and surrounding residential streets. No facilities. The vibe is mellow and local—this is a neighborhood break, not a scene.'
WHERE name = '204s' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Rockpile (Laguna Beach)
UPDATE beaches SET
  best_conditions_prose = 'Needs a solid SW swell (190-230°) in the 4-6+ ft range to break properly over the shallow reef. High tide is essential—the reef is exposed and dangerous at low tide, and the wave barely breaks at mid-tide without enough size. Light NE offshores groom the faces. Fall is the sweet spot when south swell energy combines with offshore Santa Ana winds. Summer is more consistent for swell but winds are less reliable.',
  wave_tips = 'A shallow reef break that produces a defined right-hand wave with steep drops and occasional barrels on offshore days. The takeoff zone is gnarly—boils from the reef are everywhere and the drop is immediate. The right shoulder is rippable with good wall, but the wave is short—50-75 yards on a good one. Lefts exist but are shorter and less defined. Sea urchins and the reef itself are real hazards at lower tides. Experienced intermediates and above only. Shortboard or step-up for bigger days.',
  crowd_tips = 'The challenging conditions and tide-dependent nature thin the crowd naturally. On a clean SW swell at high tide, expect 10-15 surfers on the main peak. The takeoff zone is small so it feels crowded fast. Limited street parking along Cliff Drive near Heisler Park. The Laguna locals are chill but know this reef intimately—give them space on the peak.'
WHERE name = 'Rockpile' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Strands (Dana Point)
UPDATE beaches SET
  best_conditions_prose = 'Best on a S-SW swell (180-220°) in the 3-5 ft range or a large W-WNW swell (270-290°) that wraps in. Prefers shorter-period swells and combo swells—long-period NW swells tend to close out the beach. Mid-tide works best. Light NE-E offshores. Summer south swells are the primary season, with fall combo swells offering the best shape and least wind.',
  wave_tips = 'A shifty beach break that sits in Salt Creek''s shadow—it''s rarely as good as the point to the north but always less crowded. The sand bottom produces both lefts and rights, but the peaks are unpredictable and can be sectiony. Randomly submerged rocks make the lineup sketchy, especially at lower tides. When the swell angle and sand align, there are fun walls with decent push. Better suited to experienced surfers who can read the shifting peaks. Shortboard or fish.',
  crowd_tips = 'Less crowded than Salt Creek, which is the primary appeal. When Salt Creek is packed, the overflow drifts south to Strands. On its own merits, expect 10-20 surfers on a good day. Free parking at Strands Vista Park at the top of the bluff, then walk down the stairs. The local crew is tight-knit but not aggressive.'
WHERE name = 'Strands' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- San Onofre State Beach
UPDATE beaches SET
  best_conditions_prose = 'Best on a S-SW swell (180-230°) in the 2-4 ft range. Low to mid-tide is ideal—above 4 ft of tide it gets sloshy and the wave loses shape. Light NE offshores or calm conditions. Summer is prime season when consistent south swells provide the gentle, rolling energy this break was built for. Winter NW swells can work but the angle isn''t as clean.',
  wave_tips = 'The ''Waikiki of California''—a gentle, mushy wave rolling off a padded reef 200-400 yards offshore that produces some of the slowest, most forgiving rides in Southern California. Old Man''s is the main peak: soft takeoffs, long shoulders, and enough push for cross-stepping and noserides without any real consequence. Rights and lefts both work. The inside reforms into smaller green waves, giving beginners a second chance. A longboard that could float a small car is the weapon of choice. Not a performance wave—this is pure soul surfing and learning.',
  crowd_tips = 'Infamously crowded in summer—10 people on a single wave is normal at Old Man''s. The parking lot fills early on summer weekends ($15-20/day) and the entrance line rivals Disneyland. Arrive before 7am or accept your fate. The crowd is mellow to a fault—dogs on boards, lawn chairs in the lineup, beginners everywhere. Further down the beach toward Dog Patch or the cobblestones is slightly less chaotic.'
WHERE name = 'San Onofre State Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- El Porto (Manhattan Beach)
UPDATE beaches SET
  best_conditions_prose = 'A NW swell magnet—best on a clean NW-WNW swell (290-320°) in the 3-6 ft range. Almost always bigger than anywhere else in the South Bay due to the deep-water submarine canyon offshore. Mid-tide produces the best shape. NE offshores or glassy mornings are essential as afternoon onshores blow it out daily. Fall is the sweet spot: consistent NW swell, warm water, and occasional Santa Ana offshores. Combo swells with some south energy produce the best-shaped banks.',
  wave_tips = 'A punchy, fast beach break with shifting sandbars that create steep takeoffs and powerful sections. The trick is finding the ''holes''—gaps in the closeouts where peaks form and offer short but intense rides. When the sandbars are dialed and the swell has some cross angle, it can get genuinely good with hollow sections and fast walls. Too much swell from one direction closes it out wall-to-wall. Rights and lefts both work depending on the bar. Not a long-ride wave—this is a quick-burst, high-energy beach break. Shortboard, fish, or step-up for overhead days.',
  crowd_tips = 'The most consistent wave in the South Bay means it''s crowded whenever it''s working. Expect 30-50 surfers on a good morning spread across the peaks north of 45th Street. The local crew trains here daily and knows exactly where the sandbars are. Dawn patrol is the only way to beat the worst of it. Free street parking on Highland Ave fills by 7am on weekends; the lot at 45th Street is another option. After your session, the walk up the hill to the parking lot is a quad burner.'
WHERE name = 'El Porto (Manhattan)' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- =============================================
-- ADDITIONAL CALIFORNIA (19 beaches)
-- =============================================

-- Church (San Onofre)
UPDATE beaches SET
  best_conditions_prose = 'SW swell 2-4 ft with light ENE offshore wind. Medium-high tide fills in the cobblestone bottom and produces long, down-the-line rights with occasional hollow sections.',
  wave_tips = 'Mellow reef-padded beach break with lefts and rights. High tide = mushier but safer for boards. Low tide exposes rocks and creates more defined shape. Best on summer S/SW swells. Longboard or mid-length recommended.',
  crowd_tips = 'Crowded on summer weekends but the wide takeoff zone spreads people out. Weekday mornings are manageable. Mellow, old-school San Onofre vibe—etiquette is relaxed.'
WHERE name = 'Church' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Cottons (San Onofre)
UPDATE beaches SET
  best_conditions_prose = 'Low tide with clean E wind and a solid S-SW swell. First break in the area to blow out when wind picks up—dawn patrol or glassy evenings only.',
  wave_tips = 'Cobblestone point/reef producing a dreamy left on the right swell. Can get hollow on the inside reef section. Holds size well on bigger swells as the lineup moves outside. Watch for rocks and urchins on the bottom.',
  crowd_tips = 'Usually uncrowded compared to Old Man''s, but packs out when a real swell hits. Access requires a hike or bike ride, which filters out casual crowds. Respect the locals who surf it daily.'
WHERE name = 'Cottons' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Middles (San Onofre)
UPDATE beaches SET
  best_conditions_prose = 'W-WNW swell with E offshore wind. Works on most tides. Best in fall/winter when west energy fills in—summer SW swells favor Lowers instead.',
  wave_tips = 'Fickle beach break with lefts and rights that can get hollow but lacks the point structure of Lowers. Shape depends heavily on swell direction and period. Good alternative when Lowers is too crowded. Longboards welcome.',
  crowd_tips = 'Less crowded than Lowers by a wide margin. Draws an intermediate crowd looking to avoid the Trestles zoo. Mellow vibe—more about wave count than performance.'
WHERE name = 'Middles' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Trails (San Onofre)
UPDATE beaches SET
  best_conditions_prose = 'Combo SSW and WNW swells with E offshore wind. Best on a rising mid-tide. Sept-Oct offers the cleanest conditions before winter onshores dominate.',
  wave_tips = 'Exposed beach break that gets punchy when dual swells combine. Generally uncrowded with shifting peaks up and down the sand. More raw and less groomed than the main San Onofre breaks. Fun on a fish or mid-length.',
  crowd_tips = 'Rarely crowded—the hike in filters most people. You can often find peaks to yourself even on weekends. Laid-back vibe with locals who prefer solitude over scene.'
WHERE name = 'Trails' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Old Man's (SanO) (San Clemente)
UPDATE beaches SET
  best_conditions_prose = 'S-SW swell 2-4 ft with light E offshore wind. Medium tide keeps the cobblestone reef padded—too low exposes rocks, too high drowns the wave.',
  wave_tips = 'California''s quintessential longboard wave. Mushy rights and lefts roll off a padded cobblestone reef 200-400 yards out. Bring a 9''0"+ log—shortboards are pointless here. The wave is slow, forgiving, and perfect for cross-stepping and nose rides.',
  crowd_tips = 'Party wave central—10 people on a wave is normal in summer. No real priority system. Dogpatch to the right or Barbwires to the left offer breathing room. Dawn patrol thins the herd significantly.'
WHERE name = 'Old Man''s (SanO)' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Poche Beach (San Clemente)
UPDATE beaches SET
  best_conditions_prose = 'SSW swell with NE offshore wind at mid-tide. Sept offers the best window—52% clean surfable days. Groundswells from the south-southwest are ideal.',
  wave_tips = 'Beach-and-reef hybrid: small days produce fun shifting peaks on sand; bigger S and W swells push the lineup onto the outside reef with lefts and rights reforming inside. Gravel-and-sand bottom with erosion issues—watch your step entering.',
  crowd_tips = 'Reasonably uncrowded for south OC. The gravel beach and less obvious access keep casual crowds at bay. Mostly intermediate locals who know the reef lines.'
WHERE name = 'Poche Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- San Clemente State Beach (San Clemente)
UPDATE beaches SET
  best_conditions_prose = 'S-SW swell with NE offshore wind. Responds well to short and mid-period W-WNW swells too. Summer and autumn bring the most consistent south energy.',
  wave_tips = 'Standard south OC beach break with shifting sand-bottom peaks producing lefts and rights. Nothing exceptional but reliable and fun in the 2-4 ft range. Good fallback when the named breaks are too crowded.',
  crowd_tips = 'Less crowded than T-Street and the pier—the state beach parking fee filters out some of the crowd. Mellow vibe with a mix of families and intermediate surfers.'
WHERE name = 'San Clemente State Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Doheny Beach (Dana Point)
UPDATE beaches SET
  best_conditions_prose = 'NW-W swell in winter for the biggest days (4-6 ft faces), but any S-SW swell produces rideable waves. Light offshore winds from the E. Higher tide softens the cobblestone entry.',
  wave_tips = 'One of OC''s easiest waves—soft shoulders peel over cobblestone bottom after slipping past the harbor jetty. Three breaks: Boneyards, Second Spot, and Rivermouth. Longboard paradise. Avoid after rain—San Juan Creek runoff tanks water quality.',
  crowd_tips = 'Packed on weekends with surf camps, families, and beginners. Weekday mornings are your best window. The wide spread of peaks helps, but expect company year-round.'
WHERE name = 'Doheny Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Agate Street (Laguna Beach)
UPDATE beaches SET
  best_conditions_prose = 'W swell with ENE offshore wind at mid-tide. Winter months, especially January, produce the most consistent clean days (48% rideable).',
  wave_tips = 'Exposed reef break with lefts and rights breaking over boulders for about 50 meters. Steep takeoffs with good sections for turns. Intermediate-plus—the reef is shallow and unforgiving. Best on solid W or SW groundswell with enough push to clean up the sections.',
  crowd_tips = 'Sometimes crowded but not a zoo. Rocky access and reef hazards filter out beginners. Take care with rocks in the lineup—booties recommended.'
WHERE name = 'Agate Street' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Thalia Street (Laguna Beach)
UPDATE beaches SET
  best_conditions_prose = 'S-SW swell with offshore E wind. Tide-dependent—scattered reef and rock outcrops alter the wave at different levels. Summer S swells are the most dependable.',
  wave_tips = 'Rocky reef break with lefts and rights that range from cruisey knee-high rollers to hollow overhead ledges. Timing matters—the rocks and reef shift dynamics with tide and swell direction. Can hold overhead surf when it''s pumping. Fun on everything from a fish to a longboard.',
  crowd_tips = 'One of Laguna''s most dependable waves, so expect traffic. Summer tourists inflate the numbers but sort themselves out on solid swells. Mostly chill vibe—locals and visitors coexist.'
WHERE name = 'Thalia Street' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Huntington Beach Pier (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'WSW groundswell with NE offshore wind. Northside pier bowl fires on solid S swells at low-to-mid tide. Early morning glass before onshores fill in by 11 AM.',
  wave_tips = 'The pier creates defined peaks on both sides. Northside bowl is the prize—short, wedgy rights that can barrel on S swells. Southside offers longer walls. Watch for pilings and other surfers in tight quarters. Intermediate-advanced—the crowd and structure demand awareness.',
  crowd_tips = 'Surf City USA lives up to the name—very crowded, especially on any rideable swell. Contest site draws competitive locals and aspiring pros. Dawn patrol is essential for any breathing room.'
WHERE name = 'Huntington Beach Pier' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Huntington Beach Pier Northside (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'Solid S swell with NE offshore wind at low-to-mid tide. The pier bowl needs push—waist-high minimum to form properly. Best shape on combo S+W swells.',
  wave_tips = 'The main attraction at HB Pier. The northside bowl produces short, wedgy rights that can barrel on solid south swells. Steep takeoffs with a fast wall section. Watch for the pilings—wipeouts near the pier are consequential. Not a longboard wave.',
  crowd_tips = 'Very crowded and competitive. Local rippers, contest surfers, and photographers create a zoo on good days. Priority goes to position and aggression. Dawn patrol or nothing.'
WHERE name = 'Huntington Beach Pier Northside' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Huntington Beach Pier Southside (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'S-SW swell with NE offshore wind. Low-to-mid tide shapes the peaks best. Works on a wider swell window than the northside but with less defined shape.',
  wave_tips = 'Longer, more open walls than the northside bowl. Lefts peel away from the pier and offer more room to work. Less hollow than the north side but more forgiving. Still watch for pier pilings on the inside. Intermediate-friendly on moderate swells.',
  crowd_tips = 'Very crowded but slightly less intense than the northside. Draws a mix of shortboarders and longboarders. The wider takeoff zone spreads people out compared to the concentrated bowl on the north side.'
WHERE name = 'Huntington Beach Pier Southside' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- North HB Streets (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'NW-W groundswell with NE offshore wind. Low-to-mid tide shapes the sandbars best. Early morning glass is essential—onshores arrive by late morning.',
  wave_tips = 'Long, open beach break stretch with shifting peaks. Picks up NW swell well and is often bigger than spots further south. Peaks can be peaky and fast or walled-out depending on sand. Walk the beach to find the best bank—it changes seasonally.',
  crowd_tips = 'Very crowded in summer but the long stretch of beach means you can usually walk to a less packed peak. Locals are territorial on the better banks. Weekday mornings are your friend.'
WHERE name = 'North HB Streets' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Huntington St. (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'W-NW swell with NE offshore wind. Works on a wide swell window. Early mornings before the onshore fills in by 11 AM. Mid-tide for best shape.',
  wave_tips = 'Standard HB beach break with shifting sand-bottom peaks. Consistent and accessible—picks up swell from nearly every direction. The wave quality is average but the wave count is high. Fun on any board in the 2-4 ft range.',
  crowd_tips = 'Crowded on good days but the open beach provides room to spread out. Mix of all skill levels. Classic Surf City vibe—everyone from groms to old-timers.'
WHERE name = 'Huntington St.' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Huntington State Beach (Huntington Beach)
UPDATE beaches SET
  best_conditions_prose = 'W-NW swell with NE offshore wind at mid-tide. The open beach is wind-exposed, so dawn patrol is critical. Winter W swells produce the most consistent shape.',
  wave_tips = 'Wide-open beach break south of the pier with scattered peaks. Less structured than the pier zone—peaks are spread out and shift with the sand. Reliable 2-4 ft fun on most swells. Closeouts increase on overhead-plus days. Good for all board types on moderate swells.',
  crowd_tips = 'Crowded near the main parking areas but walkable to emptier peaks. The state beach vibe is more family-friendly and less aggressive than the pier zone. Summer weekends are packed with swimmers too—watch for blackball hours.'
WHERE name = 'Huntington State Beach' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- River Jetties (Newport Beach)
UPDATE beaches SET
  best_conditions_prose = 'Combo S+WNW swells with N-NE-E offshore wind. Fall is the most consistent season. The Santa Ana River jetty focuses swell energy and creates defined peaks.',
  wave_tips = 'Most consistent spot in Newport but shape varies wildly with sandbar contour. Lefts are fast and can turn hollow on S swells with offshore wind. Winter brings steep, peaky rights on the right tide. Sandbars shift constantly—if you don''t surf it regularly, great days are hit-or-miss.',
  crowd_tips = 'Crowded when the banks are lined up. The jetty concentrates surfers in a defined zone. Mix of locals and Newport regulars. Competitive but not hostile.'
WHERE name = 'River Jetties' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Newport 56th St (Newport Beach)
UPDATE beaches SET
  best_conditions_prose = 'SW groundswell with NNE offshore wind. October is the prime month—54% clean surfable days. Sheltered enough to handle moderate wind better than open beach stretches.',
  wave_tips = 'Consistent sheltered beach break that works year-round. Picks up distant groundswells well. Multiple swells combine to produce bigger sets than expected. Shape depends entirely on the sandbars—walk the beach to find where banks are forming. Standard Newport fare: fast peaks with occasional hollow sections.',
  crowd_tips = 'Very crowded when the surf is up—Newport''s population density guarantees company. The crowd is mixed: experienced locals, weekend warriors, and summer tourists. Early mornings offer the best ratio of waves to people.'
WHERE name = 'Newport 56th St' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Newport Upper Jetties (Newport Beach)
UPDATE beaches SET
  best_conditions_prose = 'S-SW swell with NE offshore wind. Handles 4-8 ft faces well. Fall delivers the most consistent combo swell conditions.',
  wave_tips = 'Punchier and steeper than the lower jetties. Steep drop-ins on S-SW swells reward quick pop-ups and confident positioning. Both lefts and rights but the rights tend to have more wall. Sand bottom shifts—some days it''s hollow, other days it closes out. Intermediate-plus.',
  crowd_tips = 'Very crowded on good days—Newport density makes solitude impossible when it''s firing. Competitive locals who surf here daily. Dawn patrol or accept the crowd.'
WHERE name = 'Newport Upper Jetties' AND state = 'CA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- =============================================
-- HAWAII (6 beaches)
-- =============================================

-- Pipeline (Haleiwa)
UPDATE beaches SET
  best_conditions_prose = 'NW groundswell 6-10 ft, light S-SE offshore, rising mid tide. Nov-Feb peak season.',
  wave_tips = 'Heavy, hollow lefts over shallow first reef; Backdoor rights on NW angle. 6-10 ft is the barrel sweet spot — above 12 ft Second Reef activates. Only 2-3 ft of water over the reef at low tide. Bring a step-up or gun, not your daily driver.',
  crowd_tips = 'Strict local hierarchy — 20+ regulars rotate the peak. Visiting pros wait their turn. Do not paddle out unless you are genuinely expert-level; watch from the beach first.'
WHERE name = 'Pipeline' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Waikiki (Aquarium)
UPDATE beaches SET
  best_conditions_prose = 'Mid-high tide, clean 2-4 ft S swell, light NE offshore winds. Fires best May-Sep.',
  wave_tips = 'Fast lefts over shallow live coral reef — one of the longest lefts on the south shore. Softer on higher tide, hollower on low. Dangerously shallow at dead low — time your sessions accordingly. Longboard or fish works well at 2-3 ft.',
  crowd_tips = 'Less packed than Canoes or Queens despite consistent surf. Bit of a paddle out filters the tourist crowd. Intermediate+ skill expected by locals.'
WHERE name = 'Waikiki (Aquarium)' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Waikiki Beach (Honolulu)
UPDATE beaches SET
  best_conditions_prose = 'Clean S swell 2-4 ft, light N-NE offshore wind, mid tide. Peaks Jun-Sep with Southern Hemi groundswell.',
  wave_tips = 'Slow, forgiving walls perfect for longboarding. Southern Hemisphere groundswells arrive mellow after 3,000+ miles of open ocean. Queens side has shapelier rights; further inside is softer and more beginner-friendly. Grab a longboard or foamie.',
  crowd_tips = 'Extremely crowded — surf schools, outrigger canoes, and tourists fill the lineup by mid-morning. Dawn sessions or smaller swell days buy you space.'
WHERE name = 'Waikiki Beach' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Hapuna Beach (Kohala)
UPDATE beaches SET
  best_conditions_prose = 'W-NW swell 3-5 ft, E-NE offshore, mid-high tide. Winter months, especially Jan.',
  wave_tips = 'Beach break lefts and rights; bigger W swells can activate a left point along the southern edge. Shadowed from pure N swells by the island''s northern tip and from S swells by the SW coast, so it needs a westerly component. Fun on a fish or longboard at 3-5 ft.',
  crowd_tips = 'Light crowds most days — not a destination surf spot. Rip currents pick up with size. Beware of sharks in deeper water outside the break.'
WHERE name = 'Hapuna Beach (Kohala)' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Hanalei (Wainiha) — Colony Resort (Kauai)
UPDATE beaches SET
  best_conditions_prose = 'N-NW groundswell 4-8 ft, S-SE offshore, rising tide. Winter peak Nov-Feb.',
  wave_tips = 'Long right point breaking 300+ yards over lava reef with barrel sections and an inside bowl. Powerful wave that handles size well — on a solid NW swell it''s one of Kauai''s longest rides. 15-minute paddle out; strong cross-bay currents on bigger days. Bring a shortboard or step-up.',
  crowd_tips = 'Moderate to crowded when firing. Locals gravitate to the outer reef; inside bay is mellower. Localism can be strong — respect the lineup and don''t snake the peak.'
WHERE name = 'Hanalei (Wainiha) — Colony Resort' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Waikoloa Village Lagoon (Big Island)
UPDATE beaches SET
  best_conditions_prose = 'W-NW swell 2-4 ft, E offshore, mid-high tide. Winter has most rideable days.',
  wave_tips = 'Protected lagoon beach break with small, inconsistent surf — rideable waves only ~12% of winter days. More bodyboard and bodysurf territory than shortboard. When trades pick up, the bay is better for kite/windsurfing. Fun for beginners when small swell sneaks in.',
  crowd_tips = 'Very light surf crowd — mostly resort guests and families. Not a destination break. Best for a casual session when conditions align.'
WHERE name = 'Waikoloa Village Lagoon' AND state = 'HI'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- =============================================
-- PACIFIC NORTHWEST — Oregon (8 beaches)
-- =============================================

-- Pacific City (Cape Kiwanda)
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, E wind, 3-8 ft W-WNW groundswell. South side reef right lights up on clean overhead W swells when sandbars cooperate.',
  wave_tips = 'Beach break lefts and rights plus a legit right reef peak south of the cape. North end is mellow for longboards; south end jacks up with power on bigger swells. Handles size to double overhead. Bring a step-up if the reef is working.',
  crowd_tips = 'Oregon''s most popular wave — expect a full lineup on clean weekend swells. Dawn patrol or midweek sessions buy breathing room. Locals are chill but don''t snake the reef peak.'
WHERE name = 'Pacific City (Cape Kiwanda)' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Agate Beach (Newport, OR)
UPDATE beaches SET
  best_conditions_prose = 'Low to mid tide, E wind, 3-6 ft W-SW swell. Low tide extends rides along Yaquina Head — crumbling rights for 50+ yards.',
  wave_tips = 'Wide-open beach break with fun lefts and rights at all tides. Low tide is the sweet spot — waves break further out near Yaquina Head and peel longer. Summer handles 2-3 ft nicely; winter swells can max out at 15-20 ft. Mid-length or longboard for most days.',
  crowd_tips = 'Hosts the annual Surf Classic, so locals take it seriously. Gets busy on good days but the beach is wide — walk north or south for your own peak.'
WHERE name = 'Agate Beach' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Cannon Beach (Ecola/Indian)
UPDATE beaches SET
  best_conditions_prose = 'Mid incoming tide, E wind, 3-6 ft SW-W swell. Indian Beach at the north end peels right with more shape than the open beach.',
  wave_tips = 'Two zones: Cannon Beach proper is a gentle beach break for learners, while Indian Beach (Ecola State Park, $5 day-use) is a pocket cove with peaky rights off the north wall and shorter lefts. Mid tide on the push is prime. Longboard the main beach; shortboard Indian on overhead days.',
  crowd_tips = 'Tourist-heavy in summer but most visitors watch, not surf. Indian Beach draws the committed crew — weekday mornings are your best bet for space. Respect the Ecola lineup etiquette.'
WHERE name = 'Cannon Beach (Ecola/Indian)' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Bandon
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, ESE wind, 3-6 ft W swell. Sheltered enough to stay rideable when northern spots are maxed out.',
  wave_tips = 'Open beach break with lefts and rights on sand bottom. Faces nearly due west with a wide swell window (170-335 deg). Picks up anything from S to NW, so it fires on swells other south coast spots miss. Mellow walls suit longboards and mid-lengths; fun rippable peaks on cleaner days.',
  crowd_tips = 'Rarely crowded even when it''s on — southern Oregon isolation keeps lineups thin. A good option when Brookings or Gold Beach are blown out or flat.'
WHERE name = 'Bandon' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Brookings (Harris Beach)
UPDATE beaches SET
  best_conditions_prose = 'Mid to high tide, NE wind, 3-6 ft SW swell. Offshore rocks deflect N swell, so target SW-W energy for best shape.',
  wave_tips = 'Beach break with lefts and rights. High tide brings mushier walls; low tide produces faster hollow peaks that tend to close out. Offshore rocks filter northerly swell, making it smaller than Gold Beach or Crescent City. Best as a mellow longboard wave on moderate SW pushes.',
  crowd_tips = 'Southernmost Oregon surf — remote enough that crowds are light. Jetty area sees a few locals on good swells. Water is frigid year-round; 5/4 with boots and gloves.'
WHERE name = 'Brookings (Harris Beach)' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Florence South Jetty
UPDATE beaches SET
  best_conditions_prose = 'Low to mid incoming tide, NE wind, 3-5 ft SW groundswell. Only rideable when small and clean — currents are brutal otherwise.',
  wave_tips = 'Siuslaw River mouth jetty shapes mostly rights along the south rock wall, plus a hollow low-tide left inside the harbor entrance. Wedgy and powerful when it''s on but maddeningly fickle. Strong outgoing currents make this an intermediate-advanced-only spot. Not worth paddling out over 6 ft.',
  crowd_tips = 'Rarely crowded — the fickle nature and dangerous currents keep numbers low. When it''s firing, expect a handful of locals who know the currents well.'
WHERE name = 'Florence South Jetty' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Gold Beach (South Jetty)
UPDATE beaches SET
  best_conditions_prose = 'Low to mid incoming tide, E wind, 3-5 ft W swell. Spring is the sleeper season — NNW winds blow sideshore/offshore here.',
  wave_tips = 'Rogue River south jetty produces hollow right wedges on small clean W swells. Fickle but rewarding when it lines up. Winter south winds and big NW swell overload it; aim for spring or calm fall days with modest W swell. Shortboard spot — fast takeoffs and short powerful walls.',
  crowd_tips = 'Seal colony is huge — they''ll be your main lineup company. Rarely more than a handful of surfers. Fickle conditions mean you''ll often have it alone when it''s working.'
WHERE name = 'Gold Beach (South Jetty)' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Humbug Mountain (Port Orford)
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, N wind, 4-8 ft NW swell. Battle Rock fires on giant winter NW swell with strong N wind; Hubbard Creek works on smaller spring days.',
  wave_tips = 'Two breaks nearby: Battle Rock faces south and only wakes up on large winter NW swell with N offshore wind — powerful and not for beginners. Hubbard Creek is mellower, sheltered from storm surf but plagued by onshore S winds in winter. Spring is the best season for Hubbard Creek. Humbug Mountain blocks some wind.',
  crowd_tips = 'Tiny surf community in Port Orford — you''ll share waves with a small handful of committed locals at most. Remote and uncrowded even on good days.'
WHERE name = 'Humbug Mountain (Port Orford)' AND state = 'OR'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- =============================================
-- PACIFIC NORTHWEST — Washington (6 beaches)
-- =============================================

-- La Push — First Beach
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, NE wind, 3-6 ft W-NW swell. Goes full closeout over 8 ft. Summer and early fall are the realistic windows.',
  wave_tips = 'Crescent-shaped black sand beach at Quillayute River mouth with erratic sandbars and steep beach drop-off. Needs mid-sized W-NW swells — too big and it closes out everywhere. Lefts and rights with cobblestone reef sections. Best at mid tide on the push. Fun longboard wave on smaller days; shortboard the steeper peaks.',
  crowd_tips = 'Summer weekends draw Seattle-area surfers making the long drive. Hit it midweek and you''ll likely surf alone. Quileute tribal land — be respectful of the community and leave no trace.'
WHERE name = 'La Push — First Beach' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Long Beach (Boardwalk)
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, SE wind, 3-6 ft W swell. Summer with E winds is cleanest, but winter delivers more consistent size.',
  wave_tips = 'Miles of open beach break on sand — average but accessible waves with lefts and rights. So much coastline that you can always find an empty peak. Handles moderate swell nicely but closes out when overhead. Longboard or foamie territory on most days. Watch for sneaker waves and strong rips.',
  crowd_tips = 'Almost never crowded — the sheer length of beach spreads everyone out. You''ll likely have your own peak any day of the week.'
WHERE name = 'Long Beach (Boardwalk)' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Ocean Shores
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, E wind, 3-6 ft WSW swell. North Jetty provides a south-wind shadow when other spots are blown out.',
  wave_tips = 'Beach break at the north entrance to Grays Harbor. The North Jetty blocks S winds and creates a protected zone — rare advantage in Washington. Lefts and rights on sand. Damon Point break activates at 5-6 ft as a backup when the jetty is too big. Longboard-friendly on mellow days.',
  crowd_tips = 'More accessible than Westport or La Push, so weekend warriors show up. Still manageable — spread out along the beach for space. Local surf shop can dial you in on which section is working.'
WHERE name = 'Ocean Shores' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Ocean Shores / North Beaches
UPDATE beaches SET
  best_conditions_prose = 'Mid tide, E wind, 3-6 ft WSW swell. Open beach north of the jetty catches more raw swell than the protected south side.',
  wave_tips = 'Wide-open beach break stretching north from the Grays Harbor jetty. More exposed than the main Ocean Shores break — bigger and less filtered swell. Sand-bottom lefts and rights, best on moderate W-SW swells. Gets heavy and closed out fast when overhead. Good for intermediates on smaller days.',
  crowd_tips = 'Less trafficked than the jetty zone since there''s less wind protection. Drive north along the beach access roads to find empty peaks.'
WHERE name = 'Ocean Shores / North Beaches' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Westport Beach
UPDATE beaches SET
  best_conditions_prose = 'Mid to low tide, E-SE wind, 4-8 ft W-WNW groundswell. Washington''s most consistent surf — works on almost any W swell.',
  wave_tips = 'Multiple breaks in one zone: The Groins (five rock jetties north of marina) shape lefts best around low tide. The Jetty/Corner at Westhaven produces righthand points off the South Jetty for intermediates. Half Moon Bay inside the harbor is hollow and fast — advanced only on big days. Bring boards for different conditions.',
  crowd_tips = 'Washington''s surf capital — expect company, especially at The Groins on good winter swells. Dawn patrol and south wind days thin the pack. Bigfoot Surf Shop is the local hub for conditions intel.'
WHERE name = 'Westport Beach' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

-- Westport (Marina/Groins/Jetty)
UPDATE beaches SET
  best_conditions_prose = 'Low tide, S wind, 6+ ft NW-W groundswell. The Groins fire when size gets overhead and wind swings south.',
  wave_tips = 'Five rock groins north of the marina funnel swell into defined channels, producing mainly lefts that peel along the rock structures. Best around low tide with 6+ ft NW swell. The Corner/South Jetty right is the intermediate option; Half Moon Bay/The Cove goes hollow and fast on big days — experienced surfers only. Rocky hazards at all breaks.',
  crowd_tips = 'The most surfed spot in Washington — packed on clean overhead swells. Locals rip and know priority. Early morning or foul-weather sessions are your best shot at space. Check Bigfoot Surf for daily intel.'
WHERE name = 'Westport (Marina/Groins/Jetty)' AND state = 'WA'
  AND (best_conditions_prose IS NULL OR best_conditions_prose = '');

COMMIT;
