---
name: classic-epic-movie-poster
description: Transform a supplied movie poster, film still, key art, portrait, or film brief into a classic 1930s-1970s hand-painted theatrical poster and generate the finished raster image. Use whenever the user asks to restyle, repaint, redesign, or reimagine film artwork as a classic, vintage, retro, illustrated, monumental, high-concept, or old-cinema poster with bold display typography, large warm-cool color contrast, simplified painted forms, and aged lithographic print texture. Preserve period grammar without copying a reference poster's exact composition.
---

# Classic Epic Movie Poster

Turn the user's source movie poster, still, key art, or film brief into both:

1. a generated classic hand-painted epic poster image, and
2. the final image-generation prompt used to make it.

Use **Standard Mode** unless the user explicitly requests prompt-only output. Generate the image by default.

## Visual Identity

Interpret the target as a **classic 1930s-1970s illustrated theatrical one-sheet**, not as generic “vintage,” “中古,” or mid-century interior decor. Select a period composition archetype that fits the film instead of forcing every request into epic montage.

The essential grammar is:

- one monumental protagonist, face, mask, silhouette, or story symbol
- a broad painted atmosphere behind it, often a flat sky or color field
- two to four much smaller supporting figures arranged as narrative witnesses
- one tiny action, journey, or conflict frieze near the bottom
- a large, elegant display-serif film title near the top
- simplified gouache, tempera, or lithographic illustration rather than photographic compositing
- limited but vivid theatrical color, strong light/dark masses, and aged offset-print texture
- an epic, romantic, tragic, mysterious, or adventurous emotional register

The bundled `assets/classic-epic-style-reference.png` is an optional close-match reference, not a default input or analysis starting point. Do not inspect or pass it into generation unless the user explicitly asks to match that particular reference closely. Never copy its movie title, characters, setting, central silhouette, or vignette arrangement into unrelated films.

## Source Roles

Treat inputs according to their role:

- **Source poster or key art:** content authority for title, protagonist, recognizable faces, wardrobe, props, setting, genre, and story relationships.
- **Film still:** content authority for character identity, costume, location, light, and mood; infer a poster hierarchy from it.
- **Text brief only:** extract one lead figure or symbol, two supporting beats, one action beat, the exact title, and the emotional promise.
- **Bundled style reference:** style authority for scale contrast, painted simplification, montage hierarchy, typography character, and old-print finish—not story content.

If the source and style reference conflict, preserve the source film's identity and adapt only the visual grammar.

## Anti-Overfit Contract

Start from the source film's meaning and recognition cues without loading a bundled style image. Describe the intended period through medium, color blocking, typography, scale, and print process. Include a style image only when the user explicitly asks for a close visual match.

When a style image is included, change at least three structural axes from it:

- monument grammar or viewing angle
- dominant containing shape or silhouette
- vignette topology and number
- action-frieze path or location
- warm/cool palette mapping
- title scale, alignment, or relationship to the image

Never reproduce the reference's full combination of frontal pale monument, symmetrical side groups, and a bottom procession. Preserve the era's visual logic, not the reference's scene graph.

## Original Concept Compiler

Build the poster's core idea before choosing a composition.

1. Extract one source-specific recognition cue: an object, silhouette, costume detail, gesture, location, or typographic fragment.
2. Translate the requested mood into a visual relation: scale reversal, containment, pursuit, split path, reflection, repetition, absence, collision, or impossible space.
3. Combine the cue and relation into one sentence that could only describe this film or source.
4. Design the composition around that sentence. A supplied portrait does not require a large painted face; glasses, hair, clothing, posture, or another cue may become the main symbol.

Apply the **swap test** before generation: if the concept can be described as “reference poster X with its subject replaced,” reject it and generate a different metaphor. Change the primary subject type, spatial axis, title zone, and narrative relation—not only colors or characters.

## Composition Archetype Selector

Use these as loose reasoning aids after the Original Concept Compiler, never as layouts to imitate. Choose one only if it serves the source-specific metaphor.

### Epic montage

Use for historical adventure, war, saga, or ensemble drama. Build one monument, a few subordinate witnesses, and one small action beat. Vary the placement and silhouette; side groups and a bottom frieze are optional rather than mandatory.

### High-concept icon

Use for thriller, horror, science fiction, or a film with one decisive metaphor. Build one immediately legible subject-versus-threat relationship with extreme scale contrast, large negative space, and no supporting montage unless essential. Let one image explain the whole premise.

### Expressionist star portrait

Use for character drama, gothic horror, noir, romance, or a portrait-led source. Crop one painted face or figure boldly, drive it with warm highlights against cool-black shadow, and make the title a major graphic mass. Use diagonal brush fields or one small symbolic insert instead of multiple vignettes.

### Modernist symbol

Use when the film is conceptual, intimate, or abstract. Replace literal montage with one object, silhouette, or spatial paradox. Keep the palette minimal and let title, negative space, and scale carry the tension.

Select the archetype from the film's premise, not from the nearest reference image. If the source is only a portrait plus a mood, derive a symbol from a recognition cue before defaulting to a giant face.

## Content Contract

Before prompting, inspect the supplied image and write down internally:

1. **Exact title:** preserve the visible or user-supplied title. Do not invent a different film name.
2. **Monument:** choose the single face, body, object, creature, structure, or emblem that best carries the film.
3. **Recognition cues:** retain two to four details that make the film unmistakable—silhouette, costume, hairstyle, prop, vehicle, architecture, or color motif.
4. **Witnesses:** select two to four supporting characters or secondary images that explain relationships without competing with the monument.
5. **Action beat:** choose one small journey, confrontation, chase, ritual, crowd, vehicle, or landscape event for the bottom frieze.
6. **Emotional promise:** identify whether the poster should feel epic, romantic, tragic, mysterious, adventurous, horrific, or surreal.
7. **Text scope:** keep the exact title prominent. Include a short tagline only if supplied and clearly legible. Omit dense billing unless the user asks for it.

Do not merely apply a retro filter to the original layout. Recompose the film into a clear monument → witnesses → action hierarchy.

## Standard Composition Compiler

Build the final prompt in four compact paragraphs.

### Paragraph 1 — Format and title zone

Specify:

- vertical theatrical one-sheet, default 2:3 aspect ratio unless the user requests another ratio
- narrow warm-white printed margin or softly exposed paper edge
- title occupying roughly the upper 12%–18% of the image
- aged matte poster stock, not a framed mockup

### Paragraph 2 — Monument

Specify:

- one central iconic figure or symbol occupying about 45%–65% of the poster height
- simplified hand-painted planes and decisive shadow shapes
- source-specific recognition cues
- whether the monument is frontal, profile, masked, split by light, fused with a symbol, or transformed into a landscape

The monument should read instantly at thumbnail size without becoming a photorealistic celebrity headshot.

### Paragraph 3 — Narrative montage and color

Specify:

- two to four smaller supporting vignettes at about 8%–18% of the monument's scale
- one bottom action frieze occupying roughly 6%–12% of the poster
- one dominant palette recipe with three to five colors
- approximate area shares for the warm field, cool field, ivory field, and black core
- painted gouache or lithographic transitions, selective hard-edged silhouettes, and controlled negative space

Every small vignette must serve story or relationship. Avoid a random collage of floating heads.

### Paragraph 4 — Typography, print finish, and avoids

Specify:

- exact title text in a tall, high-contrast display serif or condensed theatrical serif
- restrained secondary text, if any
- offset-lithograph grain, slightly uneven ink density, fine halftone, subtle plate misregistration, and softly faded paper
- the intended emotional register
- the negative constraints below

## Variation Engine

Choose one option from each axis. Let the source film determine the recipe; do not force every movie into the reference poster's literal layout.

### Monument Grammar

- **shadowed-icon:** one frontal face or mask reduced to bold light and dark masses
- **profile-horizon:** a giant profile dissolving into a landscape or skyline
- **symbol-within-figure:** a face or body containing a secondary emblem or scene
- **object-monument:** one prop, vehicle, building, creature, or artifact becomes the hero
- **dual-confrontation:** two opposing profiles or figures create the central tension
- **vertical-journey:** one rising figure or path organizes the poster from action frieze to title

### Supporting Montage

- **witness-wings:** small character groups on both sides of the monument
- **relationship-cascade:** two or three portraits descend diagonally by importance
- **conflict-flanks:** opposing factions occupy left and right edges
- **landscape-interruptions:** tiny settings or events puncture the main color field
- **procession-line:** a narrow horizontal trail of characters, vehicles, or figures
- **minimal-support:** one companion vignette plus one action frieze
- **one-sided-cascade:** all supporting beats descend along one edge
- **embedded-scenes:** tiny narrative images live inside the monument or symbol
- **diagonal-frieze:** one action trail cuts diagonally rather than sitting along the bottom

### Palette Recipe

- **solar:** golden yellow / burnt orange / ivory / ink black / cool blue
- **nocturne:** midnight blue / violet / moon ivory / crimson / charcoal
- **romantic:** dusty rose / vermilion / warm cream / burgundy / pale blue
- **industrial:** teal / ochre / smoke gray / rust / bone white
- **forest:** deep green / moss / parchment / brick red / black
- **arctic:** ice blue / chalk white / navy / amber / graphite

Adapt hue to the source film. Preserve iconic source colors when they carry identity, but simplify them into one coherent theatrical palette.

## Color Contrast Engine

Build contrast through **large adjacent color masses**, not through saturation alone.

- Assign roughly 40%–55% of the poster to one saturated warm field such as lemon yellow, golden orange, coral, or vermilion.
- Assign roughly 25%–40% to a clearly separate cool monument or structural field such as ice blue, pale cyan, cobalt, or ultramarine. The cool color must occupy a substantial filled shape, not a thin outline.
- Keep roughly 15%–25% as clean ivory or paper-white breathing space when the composition allows it.
- Use an ink-black core or shadow mass across roughly 8%–15% to separate the warm and cool zones and establish value contrast.
- Reserve any small accent hue for less than 3%.

Make the warm and cool masses meet along long, decisive edges. Check the poster at thumbnail size: it should immediately read as warm field versus cool monument versus black core. If the colors blend into a shared muddy midtone, increase area separation and restore saturation rather than adding more hues or texture.

### Paint Treatment

- flat gouache blocks with dry-brush edges
- tempera-like opaque highlights and deep graphic shadows
- illustrated lithograph with visible plate grain
- ink-and-wash faces over broad color fields
- posterized watercolor with controlled hard silhouettes

### Emotional Register

- epic adventure
- romantic sweep
- tragic grandeur
- political tension
- mysterious journey
- gothic dread
- surreal spectacle

## Image Generation Workflow

1. **Inspect the source.** Use image inspection before editing. Confirm the title, monument candidate, recognition cues, witnesses, action beat, and source palette.
2. **Compile an original concept.** Use the Original Concept Compiler and pass the swap test before choosing composition.
3. **Choose a recipe.** Select one loose archetype only when useful, then choose monument grammar, supporting treatment, palette, paint treatment, emotional register, and three structural differences from every visible reference.
4. **Compile the prompt.** Use the four-paragraph Standard Composition Compiler. Describe the period verbally and specify warm/cool/ivory/black area shares through the Color Contrast Engine.
5. **Generate.** Use built-in image editing/generation with the user's content source only by default. Include `assets/classic-epic-style-reference.png` only for an explicitly requested close match and label its role precisely.
6. **Inspect the result.** Check the generated image at full size and thumbnail size, then repeat the swap test against every visible reference.
7. **Regenerate once when necessary.** Tighten and retry once if the title is materially wrong, the source is unrecognizable, the result is photographic, the hierarchy becomes a collage, or the composition reads as a subject-swapped reference.
8. **Return the image, prompt, and recipe.** Do not stop at analysis unless the user explicitly asks for prompt-only output.

## Reference-Separation Language

Include wording equivalent to this only when both a source poster and the bundled style reference must be supplied:

```text
Reference image 1 is the CONTENT SOURCE: preserve its movie title, characters, costumes, props, setting, and narrative identity. Reference image 2 is ANALYSIS-ONLY STYLE GUIDANCE: borrow only its extreme scale contrast, opaque hand-painted simplification, warm-versus-cool area contrast, serif-title character, and aged lithographic finish. Use a different monument grammar, containing silhouette, vignette topology, and action path. Do not copy reference image 2's title, people, desert, robes, camels, weapons, central outline, or exact composition.
```

## Negative Constraints

Avoid:

- direct copying of the bundled reference poster's film-specific content
- modern photographic head-collage or streaming-thumbnail key art
- glossy digital airbrush, hyperreal celebrity portrait, or photo-bashed montage
- contemporary sans-serif title lockups unless the user explicitly requires the original logo
- comic-book panels, anime rendering, kawaii illustration, neon cyberpunk, or 3D CGI
- equal-sized floating heads with no visual hierarchy
- dense billing blocks, review quotes, festival laurels, platform logos, ratings, CTA, or fake credits
- decorative vintage filters that leave the original composition unchanged
- repeating the style reference's exact central silhouette, symmetrical side groups, and bottom procession
- subject-swapping a reference while keeping its dominant crop, title zone, spatial axis, or narrative relation
- using the cool hue only as an outline while the subject and background share the same warm family
- muddy midtones, sepia dominance, or texture that weakens the large warm-cool-black separation
- framed wall art, room mockups, rolled paper, glare, hard cast shadows, or visible hands
- copying an identifiable living artist's personal style; describe period, medium, composition, and print process instead

## Title Fidelity

Image models may misspell poster text. Improve the odds by:

- giving the exact title once in quotation marks
- requesting one prominent title and little or no secondary copy
- keeping the title separate from busy artwork
- using short taglines only

If the title is still wrong after the one allowed regeneration, return the best visual result and state the text limitation briefly. Do not silently claim exact fidelity.

## Output Format

Use this structure:

````markdown
**生成图**

![Classic epic movie poster](absolute-image-path-or-rendered-image)

**最终 Prompt**

```text
[final prompt used for image generation]
```

**说明**

- Mode: Standard
- Recipe: [archetype / monument / support / palette / paint / emotion]
- Preserved: [title + two or three defining film cues]
- [one short interpretation note]
````

## Quality Gate

Before finalizing, check:

- Did the result preserve the correct film title or disclose a remaining text error?
- Is the source film recognizable from at least two non-text cues?
- Is there one dominant monument rather than many equal heads?
- Did the run choose one fitting composition archetype instead of blending all of them?
- Are supporting figures clearly subordinate and narratively useful?
- Is there a small action or journey frieze near the bottom when the story supports one?
- Does the title read as theatrical display typography rather than modern app branding?
- Does the art look hand-painted and lithographically printed rather than photo-filtered?
- Is the palette limited, coherent, and adapted to the source film?
- Do substantial warm and cool fields meet visibly at thumbnail size?
- Is the cool field a filled mass rather than a thin border or accent?
- Does an ink-black core clearly separate the warm and cool values?
- Did the style reference contribute grammar without leaking its movie-specific content?
- Does the composition differ from the reference on at least three structural axes?
- Does the concept pass the swap test against every visible reference?
- Did the main symbol originate from a source-specific cue rather than the nearest reference layout?
- Does the poster still read at thumbnail size?
- Did the run actually generate an image?

## Example Requests

- “用 $classic-epic-movie-poster 把这张电影海报重绘成 60 年代史诗手绘版。”
- “把这张科幻片海报做成 60 年代古典手绘院线版，片名保持不变。”
- “用这张电影剧照做一张复古手绘院线海报。”
- “只给我 $classic-epic-movie-poster 的最终提示词，不生成图。”
