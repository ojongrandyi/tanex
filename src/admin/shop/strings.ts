// Console shop labels (CONTENT §17.8, owner to confirm, #187). English only until the console
// becomes bilingual (task I.2), like the other console screens.
export const SHOP_TEXT = {
  crop: {
    title: 'Crop picture',
    fill: 'Fill',
    fit: 'Fit whole picture',
    shape: 'Picture shape',
    background: 'Background',
    white: 'White',
    cream: 'Cream',
    zoom: 'Zoom',
    rotate: 'Rotate',
    use: 'Use this picture',
    skip: 'Skip (automatic crop)',
    cancel: 'Cancel',
    preparing: 'Preparing…',
    uploading: 'Uploading…',
    dragHint: 'Drag the picture to move it inside the square.',
    previewLabel: 'Square preview',
    tooSmall: 'This photo is too small. Use a larger photo.',
    soft: 'This photo is small and may look soft.',
    notImage: 'This file is not a picture. Use a JPG, PNG or WebP photo.',
    tooLarge: 'This file is too large (more than 20 MB).',
    failed: 'The picture could not be saved. Please try again.',
  },
} as const;
