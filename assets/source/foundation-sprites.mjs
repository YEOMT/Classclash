/**
 * Class Clash / Foundry Three — original, hand-pixelled source, October 2026.
 * Every row below is a native 1 px drawing. Parts have deliberate silhouettes,
 * material clusters and selective outlines; the build bakes articulated key poses
 * to the existing PNG atlas. No external sprite, font, image or generative asset.
 */
export const FOUNDATION_IDS = new Set(['paladin', 'brawler', 'pyromancer']);
export const FOUNDATION_ART_VERSION = 2;

const PAL = {
 paladin: { '#':0x202638, a:0x354458, b:0x596d80, c:0x8da8b6, d:0xc6d8d7, e:0xf6f1d5,
  g:0x8c653d, G:0xd3a652, Y:0xffda81, v:0x332e4b, V:0x645474, w:0x9c91ac,
  t:0x235858, T:0x3c8c83, q:0x78c3a0, s:0xb68160, S:0xe4b68a, E:0xffe6a2 },
 brawler: { '#':0x272435, a:0x353b4c, b:0x4d626d, c:0x7f9690, d:0xc9cfb1, e:0xffe5b8,
  g:0x8c543e, G:0xc57a46, Y:0xfbbd71, v:0x432c32, V:0x754035, w:0xb4653a,
  t:0x285957, T:0x438b80, q:0x8fc3a0, s:0xb87554, S:0xe9a978, E:0xffd4a0,
  r:0x9d3b36, R:0xe05c3e, H:0x392a30, h:0x76503b },
 pyromancer: { '#':0x2c2439, a:0x40304d, b:0x65425b, c:0x97536b, d:0xd28381, e:0xffd7b4,
  g:0x99573b, G:0xe39b51, Y:0xffd87c, v:0x462d48, V:0x783946, w:0xaf4c46,
  t:0x273e4c, T:0x43616b, q:0x7ea098, s:0xc78468, S:0xf0b58a, E:0xffe5b0,
  r:0xc4573c, R:0xf18c46, H:0x512c3b, h:0x9d4c42, F:0xffc65a, f:0xffffc4 }
};
const rows = s => s.trim().split('\n').map(r=>r.trim());
const ART = {
 paladin: {
  head: [rows(`
 ........##........
 .......#GG#.......
 .....##GYYG##.....
 ...##dGGGGGdc#....
 ..#dddeeeddddc#...
 .#ddeeeeeedddcc#..
 .#deeeedddcddcc#..
 #cddcaaaaaaacdbc#.
 #cdc#EEEaaEE#dbc#.
 #ccc#aaaaaaa#bbc#.
 .#ccdddaaddddbc#..
 .#bcdddaaddccbb#..
 ..#bcddaadcbbb#...
 ...#bcdddccbb#....
 ....#bcdddcb#.....
 .....#bcccbb#.....
 ......######......`), rows(`
 ........##........
 .......#GG#.......
 .....##GYYG##.....
 ...##dGGGGGdc#....
 ..#deeeedddccc#...
 .#deeeedddccccb#..
 .#deedddccccbbb#..
 #cddcaaaaaacbbbc#.
 #cdc#EEEEaaE#bbc#.
 #ccc#aaaaaaa#bbc#.
 .#cccdddaadddbb#..
 .#bccdddaadcbbb#..
 ..#bccddaacbbb#...
 ...#bccddacbb#....
 ....#bccddcb#.....
 .....#bccccb#.....
 ......######......`), rows(`
 ........##........
 .......#GG#.......
 .....##GYYG#......
 ....#deGGGGdc#....
 ...#deeedddccc#...
 ..#deeedddccccb#..
 ..#deedddcccbbb#..
 ..#ddcaaacccbbbc#.
 ..#dc#EEEEEE#bccc#
 ..#dc#aaaaaa#bbc#.
 ..#cccdddaaddbb#..
 ...#ccdddaadcbb#..
 ...#bccddacbbb#...
 ....#bccdacbb#....
 .....#bccdcb#.....
 ......#bcccb#.....
 .......#####......`), rows(`
 ........##........
 .......#GG#.......
 .....##GYYG##.....
 ...##dGGGGGdc#....
 ..#deeeedddccc#...
 .#deeeedddccccb#..
 .#deedddccccbbb#..
 #cdddcccccbbbbbc#.
 #cddcccaacbbbbb#..
 #cccddcaacbbbbb#..
 .#cccddcaacbbbb#..
 .#bccddcaacbbbb#..
 ..#bccdcaacbbb#...
 ...#bcccaacbb#....
 ....#bccdacb#.....
 .....#bcccb#......
 ......#####.......`), rows(`
 ........##........
 .......#GG#.......
 .....##GYYG##.....
 ...##dGGGGGdc#....
 ..#dddeeedddcc#...
 .#ddeeeeeedddcc#..
 .#deeeedddcddcc#..
 #cdddcccccccddbc#.
 #cddcccaaacccdbc#.
 #cccddcaaacddbbc#.
 .#cccddaaadddbc#..
 .#bccddaaadccbb#..
 ..#bccdaaacbbb#...
 ...#bccaacbbb#....
 ....#bcaaacb#.....
 .....#bcccbb#.....
 ......######......`)],
  torso:rows(`
 ......########......
 ...###ddeeeddc###...
 .##deeedGGdddddcb#..
 #deeeddGYYGddccbbb#.
 #eeedddGGGGdccbbbb#.
 #ccddddaGaddcccbbb#.
 .#bcdddaGaddccbbb#..
 ..#bcddaGaddcbbb#...
 ..#bccdaGadcbbbb#...
 ..#bcccdddccbbbb#...
 ..##GGGGYGGGGG##...
 ..#ggGGGGGGGggb#...
 ..#dddddGdddddb#...
 ..#dddddGddccbb#...
 ..#cccddGccbbbb#...
 ...#bbccGbbbb##....
 ....#########......`),
  torsoBack:rows(`
 ......########......
 ...###ddeeeddc###...
 .##deeedGGdddddcb#..
 #deedddGVVGdccbbbb#
 #ccdddGVwwVGcccbbb#
 .#bcddGVwwVGccbbb#.
 ..#bcGVwwwwVGbbb#..
 ..#bcGVwwwwVGbbb#..
 ..#bcGVwVVwVGbbb#..
 ..#bcGVwVVwVGbbb#..
 ..##GGGGYGGGGG##..
 ..#gvVwwVVwwVvg#..
 ..#gvVwwVVwwVvg#..
 ..#gvVwwVVwwVvg#..
 ..#gvVwVVVVwVvg#..
 ...#vvVVVVVVvv#...
 ....##########....`),
  cape:rows(`
 ....############....
 ...#vvVwwwwVVvv#....
 ..#vVVwweewVVVvv#...
 ..#vVwwweewwVVvv#...
 ..#vVwwwVVwwVVvv#...
 .#vVVwwwVVwwVVvvv#..
 .#vVwwwVVVwwwVVvv#..
 .#vVwwwVVVwwwVVvv#..
 #vVVwwwVVVVwwVVvvv#.
 #vVVwwwVVVVwwVVvvv#.
 #vVVwwVVVVVwwwVvvv#.
 #vVVwwVVVVVVwwVvvv#.
 #vVwwwVVvvVVwwVVvv#.
 .#VwwVVvvvvVVwwVv#..
 .#wwVVvv##vvVVww#...
 ..#wVv##..##vVw#....
 ...###......###.....`),
  thigh:rows(`
 .####..
 #bccb#.
 #cddcb#
 #dddcbb#
 #cddcbb#
 .#ccbb#.
 .#####..`),
  boot:rows(`
 .#####...
 #bccbb#..
 #cddcb#..
 #cddcb#..
 #bcbbb#..
 #bccbbb#.
 #cdddccb#
 #########`),
  upper:rows(`
 ..#####..
 .#eedccb#
 #eedccbb#
 #ddccbbb#
 #dccbbbb#
 .#ccbbb#.
 ..#####..`),
  fore:rows(`
 .#####..
 #ccddb#.
 #dddcbb#
 #ddccbb#
 #ccbbbb#
 .#GGGb#.
 .#ccbb#.
 ..####..`),
  fist:rows(`
 .####..
 #cddb#.
 #ddcbb#
 #ccbbb#
 .#####.`),
  shield:rows(`
 .....#####.....
 ...##GYYYGG#...
 ..#GYYGGGGGg#..
 .#GYGttTttGGg#.
 #GYGtTqqTTtGgg#
 #YGtTqYqqTTtGg#
 #YGtTYeeYTTtGg#
 #YGtqeeYqqTtGg#
 #YGtTYeeYTTtGg#
 #YGtTqYqqTTtGg#
 #GGGtTqqTTtGgg#
 .#GGGttTttGgg#.
 ..#GGYGGGGgg#..
 ...##GGGgg##...
 .....#####.....`),
  shieldSide:rows(`
 ...####...
 ..#YGGg#..
 .#YGTTgg#.
 #YGTTTtgg#
 #YGTTqtgg#
 #YGqYYtgg#
 #YGYeetgg#
 #YGqYYtgg#
 #YGTTqtgg#
 #YGTTTtgg#
 .#GGTTgg#.
 ..#GGgg#..
 ...####...`),
  mace:rows(`
 ....###....
 ..##ddd##..
 .#edYdddd#.
 #edYGGcbbb#
 #edYGGcbbb#
 .#ddGccbb#.
 ..##ccc##..
 ....#G#....
 ....#G#....
 ....#G#....
 ....#G#....
 ....#G#....
 ....#g#....
 ....#g#....
 ....#g#....
 ....###....`)
 },
 brawler: {
  head:[rows(`
 .....#######.....
 ...##HHhHHHH##...
 ..#HHhhhhhHHHH#..
 .#HHhhhHHHHHHHH#.
 .#HhhHSSSSsHHHH#.
 #HHHSSSSSSSsHHHH#
 #HRRRRRRRRRRRRH#.
 .#SSSSSSSSSSss#..
 .#SE#SSSSS#Ess#..
 .#SSsSSSSSSsss#..
 ..#SSSSSSSSss#...
 ..#SSSSssSSss#...
 ...#SEEEESss#....
 ....#Ssssss#.....
 .....#ssss#......
 ......####.......`), rows(`
 .....#######.....
 ...##HHhHHHH##...
 ..#HHhhhhhHHHH#..
 .#HHhhhHHHHHHHH#.
 .#HhhHSSSSsHHHH#.
 #HHHSSSSSSSsHHHH#
 #HRRRRRRRRRRRRH#.
 .#SSSSSSSSSSss#..
 .#SSSE#SSSSE#ss#.
 .#SSSSsSSSSSsss#.
 ..#SSSSSSSSSSs#..
 ..#SSSSSssSSss#..
 ...#SSEEEESss#...
 ....#SSssssss#...
 .....#sssss##....
 ......#####......`), rows(`
 .....#######.....
 ...##HHhHHHH#....
 ..#HHhhhhhHHH#...
 ..#HHhhhHHHHHH#..
 ..#HhhHSSSsHHHH#.
 .#HHHSSSSSSsHHH#.
 .#HRRRRRRRRRRRR#.
 ..#SSSSSSSSSSss#.
 ..#SSSSSSE#SSsss#
 ..#SSSSSSsSSSsss#
 ...#SSSSSSSSSSs#.
 ...#SSSSSssSSs#..
 ....#SSSEEEEss#..
 .....#SSsssss#...
 ......#sssss#....
 .......#####.....`), rows(`
 .....#######.....
 ...##HHhHHHH##...
 ..#HHhhhhhHHHH#..
 .#HHhhhHHHHHHHH#.
 .#HhhHHHHHHHHHH#.
 #HHHhhhhHHHHHHHH#
 #HRRRRRRRRRRRRH#.
 .#HHhhHHHHHHHH#..
 .#HHHHHHHHHHHH#..
 .#HHHHHHHHHHHH#..
 ..#HHHHHHHHHH#...
 ..#HHHHHHHHHs#...
 ...#HHHHHsss#....
 ....#ssssss#.....
 .....#ssss#......
 ......####.......`), rows(`
 .....#######.....
 ...##HHhHHHH##...
 ..#HHhhhhhHHHH#..
 .#HHhhhHHHHHHHH#.
 .#HhhHHHHHHHHHH#.
 #HHHhhhhHHHHHHHH#
 #HRRRRRRRRRRRRH#.
 .#HHhhHHHHHHHH#..
 .#HHHHHHHHHHHH#..
 .#HHHHHHHHHHHH#..
 ..#HHHHHHHHHH#...
 ..#HHHHHHHHHH#...
 ...#HHHHHHHH#....
 ....#ssssss#.....
 .....#ssss#......
 ......####.......`)],
  torso:rows(`
 .....########.....
 ...##SSSSSSss##...
 .##SEESSSSSSSss##.
 #SEEEESSSSSSSSsss#
 #SEESSSSSSSSSSsss#
 #SSSSSsSSsSSSSsss#
 .#SSSSsSSsSSSsss#.
 ..#SSSSssSSSsss#..
 ..#SSSSSSSSSsss#..
 ..#SSSSssSSSsss#..
 ..#SSSSssSSSsss#..
 ..#RRRRRRRRRRrr#..
 ..#GGGYYYYGGGgg#..
 ...#tTTTtTTttt#...
 ....##########....`),
  torsoBack:rows(`
 .....########.....
 ...##SSSSSSss##...
 .##SEESSSSSSSss##.
 #SEEEESsSSSSSSsss#
 #SEESSSssSSSSSsss#
 #SSSSSSssSSSSSsss#
 .#SSSSSssSSSSsss#.
 ..#SSSSssSSSsss#..
 ..#SSSSssSSSsss#..
 ..#SSSSssSSSsss#..
 ..#SSSSssSSSsss#..
 ..#RRRRRRRRRRrr#..
 ..#GGGYYYYGGGgg#..
 ...#tTTTtTTttt#...
 ....##########....`),
  thigh:rows(`
 .######..
 #TTTttt#.
 #TTTttt#.
 #TTttttt#
 #TTttttt#
 .#Ttttt#.
 ..#####..`),
  boot:rows(`
 ..#####...
 .#ddccc#..
 .#ccccc#..
 .#ddccc#..
 .#ccccc#..
 .#SSSss#..
 #SSSSsss#.
 #SSSsssss#
 ##########`),
  upper:rows(`
 .######..
 #EEESsss#
 #ESSSsss#
 #SSSSsss#
 #SSSssss#
 .#Sssss#.
 ..#####..`),
  fore:rows(`
 .#####..
 #SSSss#.
 #SSSsss#
 #SSssss#
 #ddcccc#
 #ccccc#.
 #ddccc#.
 .#####..`),
  fist:rows(`
 ..#####..
 .#RRRrr#.
 #RYYRrrr#
 #RRRRrrr#
 #RRRrrrr#
 .#ddccc#.
 ..#####..`)
 },
 pyromancer:{
  head:[rows(`
 .......##.........
 ......#gG#........
 .....#gYYG#.......
 ...##gYYYYG##.....
 ..#gGGGGGGGGg#....
 .#wRRRGYYGRRrw#...
 #wwRRwwGGwwRRrw#..
 #VwHHhhhhhHHwVw#..
 #VHHhSSSSShHHVV#..
 .#HHSSSSSSSsHH#...
 .#HSE#SSS#EsHH#...
 .#HSSSSSSSSsHH#...
 .#HSSSSssSSsHH#...
 ..#HSEEEESssH#....
 ..#HHssssssHH#....
 ...#HHssssHH#.....
 ....#HH##HH#......
 .....##..##.......`), rows(`
 .......##.........
 ......#gG#........
 .....#gYYG#.......
 ...##gYYYYG##.....
 ..#gGGGGGGGGg#....
 .#wRRRGYYGRRrw#...
 #wwRRwwGGwwRRrw#..
 #VwHHhhhhhHHwVw#..
 #VHHhSSSSShHHVV#..
 .#HHSSSSSSSSsH#...
 .#HSSSE#SSE#sH#...
 .#HSSSSSSSSSsHH#..
 .#HSSSSSssSSsHH#..
 ..#HSSEEEESssH#...
 ..#HHsssssssH#....
 ...#HHssssHH#.....
 ....#HH##HH#......
 .....##..##.......`), rows(`
 .......##.........
 ......#gG#........
 .....#gYYG#.......
 ....#gYYYYG##.....
 ...#gGGGGGGGGg#...
 ..#wRRRGYYGRRrw#..
 .#wwRRwwGGwwRRrw#.
 .#VwHHhhhhhHHwVw#.
 .#VHHhSSSSShHHVV#.
 ..#HHSSSSSSSSsHH#.
 ..#HSSSSSE#SSssHH#
 ..#HSSSSSSSSSsssH#
 ..#HSSSSSssSSssH#.
 ...#HSSSEEEEssHH#.
 ...#HHsssssssHH#..
 ....#HHssssHHH#...
 .....#HH##HHH#....
 ......##..###.....`), rows(`
 .......##.........
 ......#gG#........
 .....#gYYG#.......
 ...##gYYYYG##.....
 ..#gGGGGGGGGg#....
 .#wRRRGYYGRRrw#...
 #wwRRwwGGwwRRrw#..
 #VwHHhhhhhHHwVw#..
 #VHHhhhhhHHHHVV#..
 .#HHhhhhHHHHHH#...
 .#HHhhhHHHHHHH#...
 .#HHhhHHHHHHHH#...
 .#HHhHHHHHHHHH#...
 ..#HHHHHHHHHH#....
 ..#HHHHHHHHHH#....
 ...#HHHHHHHH#.....
 ....#HH##HH#......
 .....##..##.......`), rows(`
 .......##.........
 ......#gG#........
 .....#gYYG#.......
 ...##gYYYYG##.....
 ..#gGGGGGGGGg#....
 .#wRRRGYYGRRrw#...
 #wwRRwwGGwwRRrw#..
 #VwHHhhhhhHHwVw#..
 #VHHhhhhhHHHHVV#..
 .#HHhhhhHHHHHH#...
 .#HHhhhHHHHHHH#...
 .#HHhhHHHHHHHH#...
 .#HHhHHHHHHHHH#...
 ..#HHHHHHHHHH#....
 ..#HHHHHHHHHH#....
 ...#HHHHHHHH#.....
 ....#HH##HH#......
 .....##..##.......`)],
  torso:rows(`
 ......######......
 ....##GGYYGG##....
 ...#wVgYeegVww#...
 ..#wwVgYeeGVwww#..
 ..#wwVgGGGGVwww#..
 ..#wwVVwGGwVwww#..
 ..#wVVVwGGwVVww#..
 ...#VVVwGGwVVw#...
 ...#GGGGYYGGGG#...
 ...#gGGGYYGGGg#...
 ..#wVVVwGGwVVww#..
 ..#wVVVwGGwVVww#..
 .#wwVVVwGGwVVwww#.
 .#wVVVVwGGwVVVww#.
 #wwVVVVwGGwVVVwww#
 #wwVVVwwGGwwVVVww#
 #wVVVVwwGGwwVVVVw#
 #wVVVVwwGGwwVVVVw#
 #wVVVwwwGGwwwVVVw#
 .#GGGGGGYYGGGGGG#.
 ..#ggGGGYYGGGgg#..
 ...############...`),
  torsoBack:rows(`
 ......######......
 ....##GGYYGG##....
 ...#wVgGYYgVww#...
 ..#wwVVgGGgVwww#..
 ..#wwVVVggVVwww#..
 ..#wwVVVwwVVwww#..
 ..#wVVVVwwVVVww#..
 ...#VVVVwwVVVw#...
 ...#GGGGYYGGGG#...
 ...#gGGGYYGGGg#...
 ..#wVVVwGGwVVww#..
 ..#wVVVwGGwVVww#..
 .#wwVVVwGGwVVwww#.
 .#wVVVVwGGwVVVww#.
 #wwVVVVwGGwVVVwww#
 #wwVVVwwGGwwVVVww#
 #wVVVVwwGGwwVVVVw#
 #wVVVVwwGGwwVVVVw#
 #wVVVwwwGGwwwVVVw#
 .#GGGGGGYYGGGGGG#.
 ..#ggGGGYYGGGgg#..
 ...############...`),
  thigh:rows(`
 .####..
 #VVvv#.
 #VVvv#.
 #VVvv#.
 .#vv#..
 ..##...`),
  boot:rows(`
 .####...
 #Vvvv#..
 #Vvvv#..
 #GGgg#..
 #Vvvvv#.
 #VVvvvv#
 ########`),
  upper:rows(`
 ..####..
 .#wwVV#.
 #wwVVvv#
 #wVVVvv#
 #VVVVvv#
 #GGGGgg#
 .#GGgg#.
 ..####..`),
  fore:rows(`
 .#####.
 #wVVvv#
 #wVVvv#
 #GGGgg#
 #YGGgg#
 .#SSs#.
 ..###..`),
  fist:rows(`
 .###..
 #SSs#.
 #ESss#
 #SSss#
 .####.`),
  staff:rows(`
 .....#.....
 ....#R#....
 ...#RF#....
 ..#RFFR#...
 ..#RFfFR#..
 .#RFfffF#..
 .#RFFfFR#..
 ..#RFFR#...
 ...#GG#....
 ..#GYYG#...
 ...#GG#....
 ....#G#....
 ....#G#....
 ....#g#....
 ....#G#....
 ....#G#....
 ....#g#....
 ....#G#....
 ....#G#....
 ....#g#....
 ....#G#....
 ....#G#....
 ....#g#....
 ....#G#....
 ....#g#....
 ....###....`)
 }
};

// True east profiles and three-quarter heads are separately pixelled. The
// cheek/nose, single eye and hair mass are intentionally different silhouettes.
ART.brawler.head[1]=rows(`
 .....#######.....
 ...##HHhHHHH##...
 ..#HHhhhhhHHHH#..
 .#HHhhhHHHHHHHH#.
 .#HhhHHSSSSHHHH#.
 #HHHhHSSSSSSHHHH#
 #HRRRRRRRRRRRRH#.
 .#HHSSSSSSSSss#..
 .#HSSSE#SSE#Sss#.
 .#HSSSSsSSSSSss#.
 ..#SSSSSSSSSSss#.
 ..#SSSSSSssSSs#..
 ...#SSSEEEESss#..
 ....#SSsssss##...
 .....#ssssss#....
 ......######.....`);
ART.brawler.head[2]=rows(`
 .......######....
 .....##HhhHHH#...
 ....#HhhhhHHHH#..
 ....#HhhHHHHHHH#.
 ....#HhHHSSsHHH#.
 ...#HHHHSSSSsHH#.
 ...#HRRRRRRRRRR#.
 ....#HHSSSSSSSs#.
 ....#HHSSSSE#SSs#
 ....#HHSSSSSSSSss#
 .....#HSSSSSssSs#
 .....#HSSSEEEE#..
 ......#SSSSsss#..
 .......#SSsss#...
 ........#sss#....
 .........###.....`);
ART.pyromancer.head[1]=rows(`
 ........##........
 .......#gG#.......
 ......#gYYG#......
 ...###gYYYYG#.....
 ..#gGGGGGGGGg#....
 .#wRRRGYYGRRrw#...
 #wwRRwwGGwwRRrw#..
 #VwHHhhhhhHHwVw#..
 #VHHhhHSSShHHVV#..
 .#HHhHSSSSSSsH#...
 .#HHHSSSE#SE#sH#..
 .#HHHSSSSSSSSsHH#.
 .#HHHSSSSssSSsHH#.
 ..#HHSSSEEEEssH#..
 ..#HHHsssssssH#...
 ...#HHHssssHH#....
 ....#HHH##HH#.....
 .....###..##......`);
ART.pyromancer.head[2]=rows(`
 .........##.......
 ........#gG#......
 .......#gYYG#.....
 ......#gYYYYG#....
 ....##gGGGGGGg#...
 ...#wRRRGYYGRrw#..
 ..#wwRRwwGGwRRrw#.
 ..#VwHHhhhhhHwVw#.
 ...#HHhhhHSSHHV#..
 ...#HHhhHSSSSsH#..
 ...#HHHHSSSE#SSs#.
 ...#HHHHSSSSSSSss#
 ...#HHHHSSSSssSs#.
 ....#HHHSSEEEE#...
 ....#HHHHssssH#...
 .....#HHHHssHH#...
 ......#HHH#HH#....
 .......###.##.....`);
ART.paladin.head[2]=rows(`
 .........##.......
 ........#GG#......
 ......##GYYG#.....
 .....#deGGGGd#....
 ....#deeedddcc#...
 ...#deeedddccc#...
 ...#deedddccbbb#..
 ...#ddccacccbbbc#.
 ...#ddc#EEEEE#ccc#
 ...#ddc#aaaaa#bbc#
 ...#cccccdaaddbb#.
 ....#cccddaadcbb#.
 ....#bccddaacbb#..
 .....#bccdaacb#...
 ......#bccdacb#...
 .......#bcccb#....
 ........#####.....`);
ART.brawler.torsoSide=rows(`
 ....######....
 ..##SSSSss#...
 .#SEESSSSss#..
 #SEEESSSSsss#.
 #SESSSSSSsss#.
 .#SSSSSSSsss#.
 .#SSSssSSsss#.
 ..#SSssSSsss#.
 ..#SSSSSSsss#.
 ..#SSssSSsss#.
 ..#SSssSSsss#.
 ..#RRRRRRrrr#.
 ..#GGYYYGGgg#.
 ...#TTTTttt#..
 ....#######...`);
ART.paladin.torsoSide=rows(`
 ....######.....
 ..##deeedc##...
 .#deeedGGdcb#..
 #deeddGYYdcbb#.
 #dddccGGGccbb#.
 .#cccdGaaccbb#.
 ..#ccdGaacbbb#.
 ..#bcdGaacbbb#.
 ..#bccGaacbbb#.
 ..#bccdccbbbb#.
 ..##GGGYGGGg#..
 ..#ggGGGGggb#..
 ..#ddddGddbb#..
 ..#ddccGccbb#..
 ..#ccccGcbbb#..
 ...#bccGbbb#...
 ....#######....`);
ART.pyromancer.torsoSide=rows(`
 .....######.....
 ...##GGYYGg#....
 ..#wVgYeeGVw#...
 ..#wVgYeeGVw#...
 ..#wVgGGGGVw#...
 ..#wVVwGGwVw#...
 ..#wVVwGGwVw#...
 ...#VVwGGwV#....
 ...#GGGYYGG#....
 ...#gGGYYGg#....
 ..#wVVwGGwVw#...
 ..#wVVwGGwVw#...
 .#wwVVwGGwVww#..
 .#wVVVwGGwVVw#..
 #wwVVVwGGwVVww#.
 #wwVVwwGGwwVVw#.
 #wVVVwwGGwwVVw#.
 #wVVVwwGGwwVVw#.
 #wVVwwwGGwwwVw#.
 .#GGGGGYYGGGG#..
 ..#ggGGYYGGg#...
 ...#########....`);

// Place authored part about its anatomical anchor. Optional shear is an integer
// row displacement, so every visible pixel retains the same 1 px grid.
function stamp(g, art, x, y, palette, opts={}) {
 const w=Math.max(...art.map(r=>r.length)), ox=opts.ax??Math.floor(w/2), oy=opts.ay??0;
 for(let yy=0;yy<art.length;yy++)for(let xx=0;xx<art[yy].length;xx++){
  const c=palette[art[yy][xx]];if(c===undefined)continue;
  const px=opts.flip?w-1-xx:xx, shear=opts.shear?Math.round((yy-oy)*opts.shear):0;
  g.pixel(Math.round(x+px-ox+shear),Math.round(y+yy-oy),c);
 }
}
// Nearest-neighbour local rotation; only offline rasterisation, never a Pixi
// rotation/scaling of a finished character. Alpha remains binary until death.
function rotated(g, art, x,y, palette, angle, ax,ay) {
 const w=Math.max(...art.map(r=>r.length)),h=art.length,cos=Math.cos(angle),sin=Math.sin(angle);
 const extent=Math.ceil(Math.hypot(w,h));
 for(let dy=-extent;dy<=extent;dy++)for(let dx=-extent;dx<=extent;dx++){
  const sx=Math.round(dx*cos+dy*sin+ax),sy=Math.round(-dx*sin+dy*cos+ay);
  if(sy<0||sy>=h||sx<0||sx>=w)continue;const c=palette[art[sy]?.[sx]];
  if(c!==undefined)g.pixel(x+dx,y+dy,c);
 }
}
function seg(g, art, from,to,pal){
 const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.max(1,Math.hypot(dx,dy)),ux=dx/length,uy=dy/length;
 const w=Math.max(...art.map(r=>r.length)),h=art.length,radius=Math.ceil(length+w/2+2);
 // Anatomical endpoints are authoritative. Resample only along the limb's
 // length, preventing detached hands at the farthest contact keyframe.
 for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++){
  const along=x*ux+y*uy,across=x*uy-y*ux;if(along< -1||along>length+1)continue;
  const sx=Math.round(across+(w-1)/2),sy=Math.max(0,Math.min(h-1,Math.round((along+1)/(length+2)*(h-1))));
  const c=pal[art[sy]?.[sx]];if(c!==undefined)g.pixel(from[0]+x,from[1]+y,c);
 }
}
const KEY = {
 paladin:{
  basicAttack:[[-2,1,-8,-11,1,1,-.75],[-3,2,-10,-14,1,2,-.95],[3,2,2,1,-2,0,1.35],[3,3,3,5,-1,0,1.7],[1,2,4,4,0,0,.85],[0,0,2,0,0,0,.1]],
  skill1:[[-2,1,-1,0,-2,-1,0],[-3,2,-3,1,-1,-1,-.15],[4,2,0,2,22,-2,.3],[3,2,1,3,20,-1,.5],[1,1,2,2,11,0,.3],[0,0,2,0,0,0,.1]],
  skill2:[[0,1,0,-2,0,-1,-.1],[0,2,-2,-5,1,-4,-.35],[0,2,-3,-8,2,-7,-.45],[0,-1,0,-10,3,-10,0],[0,-1,1,-9,3,-9,.1],[0,0,1,-7,2,-7,.1],[0,0,1,-3,1,-3,.1],[0,0,0,0,0,0,.1]]
 },
 brawler:{
  basicAttack:[[-2,2,-4,1,-1,0],[-3,3,-6,2,0,0],[4,1,14,-2,-1,0],[3,2,10,-1,0,0],[1,1,3,1,1,0],[0,0,0,0,0,0]],
  skill1:[[-2,2,-3,1,-1,1],[-3,3,-5,2,0,0],[3,1,14,-2,-2,1],[2,2,-6,2,25,-3],[4,1,13,-3,-2,1],[0,1,1,0,1,0]],
  skill2:[[0,3,-1,3,0,1],[-2,6,-3,6,1,2],[-2,5,-3,6,1,2],[3,-5,9,-18,-2,0],[3,-4,8,-16,0,-1],[2,-1,7,-10,0,0],[1,1,3,-3,0,1],[0,0,0,0,0,0]]
 },
 pyromancer:{
  basicAttack:[[-1,1,-2,-2,-2,-2,-.2],[-2,2,-3,-5,-3,-4,-.35],[2,0,5,-2,10,-4,.45],[2,1,5,0,8,-2,.55],[1,1,3,0,4,-1,.3],[0,0,0,0,0,0,0]],
  skill1:[[-1,1,-1,-5,0,-4,-.15],[-2,2,-3,-8,1,-8,-.3],[3,-1,6,-4,13,-5,.45],[2,0,6,-1,10,-4,.55],[1,1,3,0,5,-2,.25],[0,0,0,0,0,0,0]],
  skill2:[[-1,2,-2,-3,-1,-2,-.15],[-2,3,-3,-6,-2,-6,-.25],[-2,3,-4,-8,-2,-9,-.35],[2,-2,6,-6,12,-11,.45],[3,-1,0,-2,14,-6,.7],[3,0,-1,0,12,-3,.9],[1,1,3,1,6,-1,.5],[0,0,0,0,0,0,0]]
 }
};
function pose(id,state,f,d){
 const k=KEY[id][state]?.[f]??[0,0,0,0,0,0,0],back=d>2,side=d===2;
 const p={x:32+k[0],y:35+k[1],headX:k[0],headY:k[1],mx:k[2],my:k[3],ox:k[4],oy:k[5],angle:k[6]??0,legL:0,legR:0,stepL:0,stepR:0,lean:0,back,side,alpha:255};
 if(state==='idle'){p.y+=f;p.headY+=f;p.my+=f;p.oy+=f;}
 if(state==='walk'){
  p.legL=[-3,0,3,0][f];p.legR=-p.legL;p.stepL=[-1,0,1,0][f];p.stepR=-p.stepL;p.y+=[0,-1,0,1][f];p.headY+=[0,-1,0,1][f];
  p.mx=[-1,0,1,0][f];p.ox=[1,0,-1,0][f];p.lean=.04;
 }
 if(state==='hurt'){p.x-=3-f;p.y+=f+1;p.headX-=4-f;p.headY+=f;p.mx-=3;p.ox+=2;p.lean=-.08;}
 if(id==='brawler'&&['basicAttack','skill1','skill2'].includes(state)){
  const contact=state==='skill2'?3:2;
  p.stepL=f<contact?-2:3;p.stepR=f<contact?2:-2;p.legL=f<contact?1:-1;p.legR=f<contact?-1:1;
  p.lean=f<contact?-.10:f===contact?.14:.07;
 }
 if(state==='spawn'){p.y+=2-f;p.headY+=2-f;p.alpha=[100,190,255][f];}
 if(state==='death'){
  p.x-=[0,1,3,6,8][f];p.y+=[2,4,7,10,10][f];p.headX-=[1,3,5,8,10][f];p.headY+=[2,5,9,13,13][f];p.mx+=[0,2,5,8,8][f];p.my+=[0,4,6,6,6][f];p.ox-=f;p.oy+=f;p.angle=[.2,.6,1.2,1.5,1.5][f];p.lean=-f*.11;p.alpha=[255,255,240,200,140][f];
 }
 return p;
}

function hand(g,id,a,p,which,pal,state,f){
 const main=which==='main',baseX=p.side?(main?6:-4):(main?10:-10),y0=p.side?(main?-3:-5):-4;
 const reach=main?p.mx:p.ox,raise=main?p.my:p.oy;
 const neutral=p.side?(id==='brawler'?(main?[8,-3]:[-3,-2]):(main?[9,3]:[-6,3])):id==='brawler'?(main?[8,-3]:[-8,-2]):id==='pyromancer'?(main?[11,3]:[-9,3]):(main?[11,3]:[-11,3]);
 const hand=[p.x+neutral[0]+reach,p.y+neutral[1]+raise];
 // North-facing arms sit farther up the body; side arms share one shoulder
 // but retain separated hands for readable equipment silhouettes.
 if(p.back)hand[1]-=2;
 const shoulder=[p.x+baseX,p.y+y0],elbow=[Math.round((shoulder[0]+hand[0])/2+(main?-1:1)),Math.round((shoulder[1]+hand[1])/2+3)];
 seg(g,a.upper,shoulder,elbow,pal);seg(g,a.fore,elbow,hand,pal);
 stamp(g,a.fist,hand[0],hand[1]-2,pal);
 if(id==='paladin'){
  if(main)rotated(g,a.mace,hand[0],hand[1],pal,p.angle,5,13);
  else{const sh=p.side?a.shieldSide:a.shield;stamp(g,sh,hand[0],hand[1]-5,pal,{ay:Math.floor(sh.length/2)});}
 }
 if(id==='pyromancer'&&main){
  const theta=p.angle-(p.side?.1:0);rotated(g,a.staff,hand[0],hand[1],pal,theta,5,20);
 }
 return hand;
}

function drawFallen(g,id,f,d){
 const a=ART[id],pal=PAL[id],angle=f===2?-.7:f===3?-1.22:-1.38,back=d>2;
 const body=[32,43],head=f===2?[24,33]:f===3?[20,42]:[19,45],hip=[40,47],feet=f===2?[[45,48],[40,53]]:[[47,48],[45,54]];
 if(id==='paladin')rotated(g,a.cape,32,47,pal,angle,10,7);
 for(let i=0;i<2;i++){
  seg(g,a.thigh,[hip[0]-i*2,hip[1]+i*2],[feet[i][0]-2,feet[i][1]],pal);
  rotated(g,a.boot,feet[i][0],feet[i][1],pal,-1.05,3,3);
 }
 rotated(g,back?a.torsoBack:a.torso,body[0],body[1],pal,angle,Math.floor(a.torso[0].length/2),8);
 const main=f===2?[40,47]:[39,52],off=f===2?[24,46]:[29,52];
 seg(g,a.upper,[32,40],[36,46],pal);seg(g,a.fore,[36,46],main,pal);stamp(g,a.fist,main[0],main[1]-2,pal);
 seg(g,a.upper,[27,43],[25,48],pal);seg(g,a.fore,[25,48],off,pal);stamp(g,a.fist,off[0],off[1]-2,pal);
 rotated(g,a.head[d],head[0],head[1],pal,f===2?-.55:-1.2,Math.floor(a.head[d][0].length/2),8);
 if(id==='paladin'){
  rotated(g,a.mace,48,53,pal,1.4,5,13);rotated(g,a.shield,27,51,pal,-.45,7,7);
 }else if(id==='pyromancer')rotated(g,a.staff,40,54,pal,1.5,5,20);
 const alpha=f===2?255:f===3?210:140;if(alpha<255)for(let i=3;i<g.data.length;i+=4)g.data[i]=Math.round(g.data[i]*alpha/255);
 return {hand:main,offhand:off,fx:[0,.71,1,.71,0][d],fy:[1,.71,0,-.71,-1][d]};
}

function drawNative(g,id,state,f,d){
 const a=ART[id],pal=PAL[id],p=pose(id,state,f,d),bodyX=p.x,bodyY=id==='pyromancer'?29+(p.y-35):29+(p.y-35);
 const death=state==='death',robe=id==='pyromancer';
 if(death&&f>=2)return drawFallen(g,id,f,d);
 const spread=p.side?3:5,legs=[[bodyX-spread+p.stepL,44+p.legL],[bodyX+spread+p.stepR,44+p.legR]];
 if(id==='paladin')stamp(g,a.cape,bodyX+(f%2&&state==='walk'?-1:0),30+(p.y-35),pal,{shear:p.lean});
 // Both feet and articulated leg plates are behind the clothing silhouette.
 for(let i=0;i<2;i++){
  const leg=legs[i];const knee=[leg[0],leg[1]-3+(p.y-35)*.4];
  seg(g,a.thigh,[bodyX+(i?4:-4),40+(p.y-35)],knee,pal);
  stamp(g,a.boot,leg[0],Math.min(55,leg[1]+1+(p.y-35)*.15),pal);
 }
 let main,off;
 // Correct overlap for north/diagonal facings. Main weapon remains visible on
 // side facings while the far forearm disappears behind the torso.
 if(p.back){main=hand(g,id,a,p,'main',pal,state,f);off=hand(g,id,a,p,'off',pal,state,f);}
 else off=hand(g,id,a,p,'off',pal,state,f);
 const torso=p.side?a.torsoSide:p.back?a.torsoBack:a.torso;
 stamp(g,torso,bodyX,bodyY,pal,{shear:p.lean});
 if(id==='brawler'){
  // Long knotted headband ends trail behind the running silhouette.
  const tailX=bodyX-7,tailY=25+p.headY,trail=state==='walk'?[-1,1,2,0][f]:0;
  g.poly([[tailX,tailY],[tailX-7-trail,tailY+2],[tailX-9-trail,tailY+7],[tailX-5-trail,tailY+6],[tailX-3,tailY+3]],pal.r);
  g.line(tailX-1,tailY+1,tailX-6-trail,tailY+4,pal.R);
 }
 // Painted head is separately offset in anticipation, recoil, uppercut and
 // crouch so animation is not a single image bobbing as a rigid object.
 const hy=id==='pyromancer'?10:id==='paladin'?11:13;
 stamp(g,a.head[d],32+p.headX,hy+p.headY,pal,{shear:death&&f>2?-.12:0});
 if(!p.back)main=hand(g,id,a,p,'main',pal,state,f);
 else if(p.side||d===3){off=hand(g,id,a,p,'off',pal,state,f);}
 if(id==='paladin'&&!p.back){
  // Near shield is in front of the body, with the forearm occluded by its rim.
  const sh=p.side?a.shieldSide:a.shield;stamp(g,sh,off[0],off[1]-5,pal,{ay:Math.floor(sh.length/2)});
 }
 if(id==='pyromancer'&&(state==='skill1'||state==='skill2')&&f<3){
  // Small held ember, baked from clustered 1 px art, belongs to the windup;
  // release projectile and impact particles are owned by combat events.
  const [hx,hy2]=off,ember=rows(f===0?`\n..R..\n.RFR.\nRFfFR\n.RFR.\n..R..`:`\n...R...\n..RFR..\n.RFfFR.\nRFfffFR\n.RFfFR.\n..RFR..\n...R...`);
  stamp(g,ember,hx,hy2-7,pal);
 }
 if(state==='hurt'&&f===0)for(let i=0;i<g.data.length;i+=4)if(g.data[i+3]){g.data[i]=Math.min(255,g.data[i]+24);g.data[i+1]=Math.min(255,g.data[i+1]+20);g.data[i+2]=Math.min(255,g.data[i+2]+12);}
 if(p.alpha<255)for(let i=3;i<g.data.length;i+=4)g.data[i]=Math.round(g.data[i]*p.alpha/255);
 return {hand:main??[p.x+11,p.y],offhand:off??[p.x-11,p.y],fx:[0,.71,1,.71,0][d],fy:[1,.71,0,-.71,-1][d]};
}

export function drawFoundation(g,hero,state,f,d){
 const native=d>4?8-d:d,p=drawNative(g,hero.id,state,f,native);
 if(d>4){for(let y=0;y<g.h;y++)for(let x=0;x<Math.floor(g.w/2);x++){
  const i=(y*g.w+x)*4,j=(y*g.w+g.w-1-x)*4;
  for(let c=0;c<4;c++){const v=g.data[i+c];g.data[i+c]=g.data[j+c];g.data[j+c]=v;}
 }p.hand[0]=63-p.hand[0];p.offhand[0]=63-p.offhand[0];p.fx=-p.fx;}
 return p;
}

export const foundationArtNotes={
 title:'Foundry Three / Original three-hero visual rework',
 original:true,nativePixel:1,cell:[64,64],pivot:[32,52],directions:8,
 ids:['paladin','brawler','pyromancer'],
 techniques:['hand-authored material clusters','selective 1px dark contours','five separately drawn facing heads plus mirrored west','articulated upper/forearm and legs','per-action anticipation/contact/follow-through keyframes','nearest-neighbour offline part rotation'],
 design:{paladin:'Ivory sallet, brass crest, sea-glass heraldic shield, plum cape, flanged ceremonial mace',brawler:'Amber skin, tousled walnut hair, long vermilion headband, wrapped iron-red fists, jade trousers, bare feet',pyromancer:'Cinder-red ceremonial headpiece, auburn bob, split garnet robe with gold inlay, forked ember staff'},
 actionContacts:{basicAttack:2,skill1:2,skill2:3,brawlerFlurry:[2,3,4]}
};
