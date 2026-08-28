# Image-to-image edit prompt

Source image: `../references/ref-02-source-v2.png`

## Invariants

- Preserve the vertical 3:4 crop and exact camera position, perspective, framing, object scale, spatial relationships, and geometry.
- Keep the train model, original red color, shape, position, windows, and doors unchanged.
- Keep the platform, platform edges, lamp posts, rail tracks, mountain forms and silhouettes unchanged.
- Keep the scene empty of people and free of text, signage, letters, numbers, logos, and watermarks.
- Change only the season, time of day, ambient lighting, snow cover, and gentle snowfall.

```text
Use case: lighting-weather
Asset type: Image Skill Studio image-to-image edit example, portrait 3:4
Primary request: Edit the supplied source image only by changing the autumn midday conditions into a winter blue-hour scene with gentle light snowfall.
Input images: Image 1 is the sole edit target and composition reference.
Scene/backdrop: The exact same alpine train station, platform, rails, red mountain train, and mountain landscape as Image 1.
Style/medium: Photorealistic travel photography matching the source image.
Composition/framing: Preserve the source image's vertical 3:4 crop, exact camera position, perspective, framing, object scale, spatial relationships, and geometry.
Lighting/mood: Winter blue hour with cool soft ambient light; subtle plausible illumination and delicate light snowfall.
Color palette: Cool blue and slate winter atmosphere while preserving the train's original red identity.
Materials/textures: Add natural settled snow appropriate to winter and small soft snowflakes in the air without obscuring key geometry.
Constraints: Change only season, time of day, ambient lighting, snow cover, and gentle snowfall. Keep the train model, train color, train shape, train position, windows, doors, platform, platform edges, lamp posts, rail tracks, mountain forms, viewpoint, perspective, crop, and composition completely unchanged. Keep the scene empty of people. No text, signage, letters, numbers, logos, or watermark.
Avoid: Moving, resizing, redesigning, replacing, or reorienting any object; changing camera angle; changing mountain silhouette; heavy snowstorm; fog that hides geometry; night darkness; motion blur; added buildings, people, vehicles, or props.
```
