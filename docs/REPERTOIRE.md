# Repertoire and provenance

The generated repertoire follows documented Reuge selections, with **Für Elise** selected first.
Each of these six scores is an independent, abridged simulator arrangement. Melody
excerpts, accompaniment, repetitions, dynamics and the division into turns are
implemented in `src/cylinder/demoLibrary.js`; no factory pin map, commercial audio
recording or modern MIDI performance is bundled.

## Historical collection

Reuge's [2014 factory catalogue](https://audio.vn/wp-content/uploads/2017/12/reuge_catalogue_2014.pdf),
printed page 55 (PDF page 57), documents INTER CH 15.72 collection **1001**:

| Cylinder | Successive airs |
| --- | --- |
| 1001-1 · Strauss | The Blue Danube; Tales from the Vienna Woods; The Artist's Life |
| 1001-2 · Bizet / Verdi | Carmen (Toréador); Rigoletto (La donna è mobile); La Traviata (Prelude) |
| 1001-3 · Mozart | The Magic Flute (Birdcatcher); Andante (Sonata in A major); The Magic Flute (Glockenspiel) |
| 1001-4 · Schumann / Schubert | Of Foreign Lands and Peoples; The Trout; Der Lindenbaum |
| 1001-5 · Tchaikovsky | Sleeping Beauty; March of the Toy Soldiers; Waltz of the Flowers |

The [Crescendo 15.72 dealer listing](https://www.musichouseshop.com/store/brAXA728256005.html)
corroborates this five-cylinder collection. Its attribution of the first air on
cylinder 4 to Schubert is corrected to Schumann, as in the factory catalogue.
The catalogue's page-55 listing is used instead of the conflicting Tchaikovsky
entries in its later Lounge table.

The additional default cylinder is **Für Elise (three parts)**, documented as
CH 3.72 tune **37220** in the [Reuge movement repertoire listing](https://www.musichouseshop.com/store/Movement72note.html).
It is an additional selection, not a claimed sixth cylinder in collection 1001.

## Arrangement choices

The catalogue establishes titles and tune order; it does not publish pin layouts
or musical transcriptions. The simulator therefore uses short public-domain
themes, repeated within a revolution, with newly written light accompaniment.
It does not reproduce complete compositions or claim note-for-note fidelity to
Reuge's arrangements. Source labels in the app and exported JSON identify this.

The Mozart catalogue says only “Andante (Sonata in A major).” Choosing the familiar
Andante grazioso theme from **K. 331** is an interpretation, not a verified factory
identification. Likewise, the Sleeping Beauty air uses a waltz theme; the factory
catalogue does not identify its excerpt. Für Elise parts I–III are simulator
excerpt divisions rather than a transcription of the 37220 cylinder's divisions.

Score references used to check the original public-domain melodies include:

- [Für Elise, WoO 59](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.ly):
  Breitkopf & Härtel, 1888; Mutopia transcription by Stelios Samelis, placed in the public domain.
- [Mozart K. 331, theme](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/MozartWA/KV331/KV331_1_1_tema/KV331_1_1_tema.ly):
  Breitkopf & Härtel; public-domain Mutopia transcription by Stelios Samelis.
- [Carmen, prelude](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/BizetG/prelude/prelude.ly):
  the original melody in the Schirmer 1895 score. Alex O'S's modern Mutopia
  typesetting is CC BY-SA 2.5; its layout, accompaniment and editorial markings
  are not reproduced here.
- [La Traviata, prelude](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/VerdiG/Traviata_Preludio/Traviata_Preludio.ly):
  N. Toledo's nineteenth-century reduction, with public-domain Mutopia typesetting
  by Alberto Corella.
- [Schumann, Kinderszenen Op. 15 No. 1](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/SchumannR/O15/SchumannOp15No01/SchumannOp15No01.ly):
  Leichte Stücke, 1900; public-domain Mutopia transcription by Ying-Chun Liu.
- [Schubert, Die Forelle](https://github.com/MutopiaProject/MutopiaProject/blob/master/ftp/SchubertF/D550/forelle/forelle-lys/melody.ly)
  and [Der Lindenbaum](https://github.com/OpenScore/Lieder/tree/main/scores/Schubert%2C_Franz/Winterreise%2C_D.911/05_Der_Lindenbaum):
  Mutopia melodic notation and OpenScore's public-domain Lieder transcription.
- [Strauss, Tales from the Vienna Woods](https://cantorion.org/music/3404/Tales-from-the-Vienna-Woods-%28G%27schichten-aus-dem-Wienerwald%29-Piano-reduction)
  and [The Artist's Life](https://imslp.org/wiki/K%C3%BCnstlerleben%2C_Op.316_%28Strauss_Jr.%2C_Johann%29):
  historical Cranz piano-score scans; the first waltz themes are reduced independently.
- Tchaikovsky's original melodies were checked against [the Nutcracker March](https://www.flutetunes.com/tunes/tchaikovsky-the-nutcracker-march.pdf),
  [Sleeping Beauty's waltz melody](https://www.osfabb.com/Sleeping_Beauty_osfabb_Score_1.pdf),
  and [Waltz of the Flowers](https://teach.files.bbci.co.uk/tenpieces/FlutesGrade45.pdf).
  The latter two are modern educational scores; their arrangements are not
  reproduced. The simulator selects short original melodic phrases, changes
  register where needed, and supplies its own accompaniment.

## Mechanical conventions

The [Reuge / MB&F MusicMachine III manual](https://www.mbandf.com/fileadmin/user_upload/Machines_Manuals/MUSICMACHINE-3-User_Manual.pdf),
page 5, describes sideways indexing after each air and one complete revolution per
air. Reuge's [Auberson instructions](https://cms.reuge.com/media/pages/presse/auberson/e9b8a30737-1734359270/auberson-instructions.pdf),
page 11, describe a 72-tooth comb, three successive melodies, over 1,200 pins, and a
36-second cycle for that movement. These support the general mechanism and the
chosen timing convention; they are not measurements of the pictured Crescendo.

The supplied simulator cylinders use three 36-second turns, a 0.3-second lead-in
for indexing, and illustrative axial spacing. They have fewer pins than the
specified factory movement because their arrangements are abridged. The default
72-pitch chromatic tuning remains a simulator convention; Reuge tunes individual
comb teeth for a particular repertoire.

## Visual inspiration

[“Magic Flute / The Birdcatcher's Song / Glockenspiel – Mozart Music Box (REUGE)”](https://www.youtube.com/watch?v=xbMqP3u7WWQ)
by [Wakey Lad93](https://www.youtube.com/@wakeylad938) is the original inspiration
video. Its title and channel were verified with YouTube's oEmbed metadata.

`public/reference.jpg` is retained as a reference photograph of the original
brass cylinder and steel comb. Its photographer and original publication are not
established in the repository; the image is excluded from the code's MIT license.
