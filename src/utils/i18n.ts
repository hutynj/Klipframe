import type { LanguageCode, ResourceTabId } from '../types/editor';

export interface Translations {
  menu: string;
  autoSaved: string;
  shortcuts: string;
  share: string;
  exportBtn: string;
  player: string;
  details: string;
  modify: string;
  dragMaterialPrompt: string;
  loadSampleProject: string;
  saveAsPreset: string;
  importFilesBtn: string;
  importSubtitle: string;
  searchPlaceholder: string;
  cover: string;
  tabs: Record<ResourceTabId, string>;
  menuItems: {
    newProject: string;
    clearTimeline: string;
    loadDemo: string;
    importMedia: string;
    projectSettings: string;
    shortcuts: string;
    language: string;
  };
  detailsFields: {
    name: string;
    aspectRatio: string;
    resolution: string;
    frameRate: string;
    duration: string;
    tracks: string;
    clipsCount: string;
    arrangeLayers: string;
    turnedOn: string;
  };
  inspector: {
    video: string;
    audio: string;
    speed: string;
    animation: string;
    adjustment: string;
    text: string;
    tts: string;
    basic: string;
    cutout: string;
    crop: string;
    templates: string;
    effects: string;
    mask: string;
    enhance: string;
    transform: string;
    scale: string;
    uniformScale: string;
    position: string;
    rotation: string;
    opacity: string;
    blendMode: string;
    flip: string;
    volume: string;
    fadeIn: string;
    fadeOut: string;
    muteClip: string;
    playbackSpeed: string;
    speedNormal: string;
    speedCurve: string;
    inAnimation: string;
    outAnimation: string;
    durationSec: string;
    brightness: string;
    contrast: string;
    saturation: string;
    temperature: string;
    exposure: string;
    hue: string;
    vignette: string;
    fade: string;
    reset: string;
    font: string;
    size: string;
    color: string;
    stroke: string;
    background: string;
    shadow: string;
    align: string;
    intensity: string;
    transitionDuration: string;
    speakPreview: string;
    addVoiceClip: string;
    chromaKey: string;
    chromaColor: string;
    chromaStrength: string;
    chromaFeather: string;
    cropFrame: string;
    cropTop: string;
    cropBottom: string;
    cropLeft: string;
    cropRight: string;
    voiceEffects: string;
    noiseReduction: string;
    normalizeAudio: string;
    keyframes: string;
    addKeyframe: string;
    removeKeyframe: string;
    reverseClip: string;
    sharpen: string;
    autoColor: string;
    rotate90: string;
    fitCanvas: string;
    fillCanvas: string;
    beatMarkers: string;
  };
  toolbar: {
    select: string;
    blade: string;
    undo: string;
    redo: string;
    split: string;
    deleteLeft: string;
    deleteRight: string;
    delete: string;
    duplicate: string;
    copy: string;
    paste: string;
    freeze: string;
    reverse: string;
    detachAudio: string;
    addMarker: string;
    addTrack: string;
    record: string;
    stopRecord: string;
    snap: string;
    ripple: string;
    fitView: string;
    clearAll: string;
    merge: string;
  };
  captions: {
    addManual: string;
    importSrt: string;
    exportSrt: string;
  };
}

export const I18N: Record<LanguageCode, Translations> = {
  es: {
    menu: 'Menú',
    autoSaved: 'Guardado auto',
    shortcuts: 'Atajos',
    share: 'Proyecto',
    exportBtn: 'Exportar',
    player: 'Reproductor',
    details: 'Detalles',
    modify: 'Modificar',
    dragMaterialPrompt: 'Arrastra material aquí y empieza a crear',
    loadSampleProject: 'Cargar proyecto de ejemplo',
    saveAsPreset: 'Guardar como preset',
    importFilesBtn: 'Importar',
    importSubtitle: 'Videos, audios e imágenes',
    searchPlaceholder: 'Buscar en la biblioteca...',
    cover: 'Portada',
    tabs: {
      import: 'Importar',
      audio: 'Audio',
      text: 'Texto',
      stickers: 'Stickers',
      effects: 'Efectos',
      transitions: 'Transiciones',
      captions: 'Subtítulos',
      filters: 'Filtros',
      adjustment: 'Ajuste',
    },
    menuItems: {
      newProject: 'Nuevo proyecto vacío',
      clearTimeline: 'Vaciar línea de tiempo',
      loadDemo: 'Restaurar proyecto de ejemplo',
      importMedia: 'Importar archivo local...',
      projectSettings: 'Configuración del proyecto',
      shortcuts: 'Atajos de teclado',
      language: 'Idioma: Español (cambiar a EN)',
    },
    detailsFields: {
      name: 'Nombre',
      aspectRatio: 'Relación de aspecto',
      resolution: 'Resolución',
      frameRate: 'Fotogramas',
      duration: 'Duración total',
      tracks: 'Pistas activas',
      clipsCount: 'Clips en línea',
      arrangeLayers: 'Orden de capas',
      turnedOn: 'Activado',
    },
    inspector: {
      video: 'Video',
      audio: 'Audio',
      speed: 'Velocidad',
      animation: 'Animación',
      adjustment: 'Ajuste',
      text: 'Texto',
      tts: 'Texto a voz',
      basic: 'Básico',
      cutout: 'Recorte',
      crop: 'Recortar',
      templates: 'Plantillas',
      effects: 'Efectos',
      mask: 'Máscara',
      enhance: 'Mejora',
      transform: 'Transformar',
      scale: 'Escala',
      uniformScale: 'Escala uniforme',
      position: 'Posición',
      rotation: 'Rotación',
      opacity: 'Opacidad',
      blendMode: 'Modo de fusión',
      flip: 'Voltear',
      volume: 'Volumen',
      fadeIn: 'Aparición',
      fadeOut: 'Desvanecer',
      muteClip: 'Silenciar clip',
      playbackSpeed: 'Velocidad',
      speedNormal: 'Normal',
      speedCurve: 'Curvas',
      inAnimation: 'Entrada',
      outAnimation: 'Salida',
      durationSec: 'Duración',
      brightness: 'Brillo',
      contrast: 'Contraste',
      saturation: 'Saturación',
      temperature: 'Temperatura',
      exposure: 'Exposición',
      hue: 'Tono',
      vignette: 'Viñeta',
      fade: 'Desvanecido',
      reset: 'Restablecer',
      font: 'Tipografía',
      size: 'Tamaño',
      color: 'Color',
      stroke: 'Contorno',
      background: 'Fondo',
      shadow: 'Sombra',
      align: 'Alineación',
      intensity: 'Intensidad',
      transitionDuration: 'Duración de transición',
      speakPreview: 'Escuchar voz',
      addVoiceClip: 'Agregar audio a la pista',
      chromaKey: 'Chroma Key (Pantalla verde)',
      chromaColor: 'Color clave',
      chromaStrength: 'Intensidad',
      chromaFeather: 'Suavizado',
      cropFrame: 'Recortar encuadre',
      cropTop: 'Superior',
      cropBottom: 'Inferior',
      cropLeft: 'Izquierda',
      cropRight: 'Derecha',
      voiceEffects: 'Efectos de voz',
      noiseReduction: 'Reducir ruido',
      normalizeAudio: 'Normalizar volumen',
      keyframes: 'Fotogramas clave',
      addKeyframe: 'Añadir fotograma clave',
      removeKeyframe: 'Quitar fotograma clave',
      reverseClip: 'Invertir reproducción',
      sharpen: 'Nitidez',
      autoColor: 'Color auto',
      rotate90: 'Rotar 90°',
      fitCanvas: 'Ajustar',
      fillCanvas: 'Llenar',
      beatMarkers: 'Generar marcas de ritmo (Beats)',
    },
    toolbar: {
      select: 'Seleccionar (V)',
      blade: 'Dividir con cuchilla (B)',
      undo: 'Deshacer (Ctrl+Z)',
      redo: 'Rehacer (Ctrl+Y)',
      split: 'Dividir en cabezal (Ctrl+B)',
      deleteLeft: 'Recortar izquierda (Q)',
      deleteRight: 'Recortar derecha (W)',
      delete: 'Eliminar (Supr)',
      duplicate: 'Duplicar clip (Ctrl+D)',
      copy: 'Copiar clip (Ctrl+C)',
      paste: 'Pegar clip (Ctrl+V)',
      freeze: 'Congelar fotograma',
      reverse: 'Invertir clip',
      detachAudio: 'Separar audio',
      addMarker: 'Añadir marcador (K)',
      addTrack: '+ Pista',
      record: 'Grabar voz en off',
      stopRecord: 'Detener grabación',
      snap: 'Ajuste magnético',
      ripple: 'Onda automática',
      fitView: 'Ajustar zoom',
      clearAll: 'Limpiar línea de tiempo',
      merge: 'Fusionar clips (M)',
    },
    captions: {
      addManual: '+ Añadir subtítulo',
      importSrt: 'Importar .SRT',
      exportSrt: 'Exportar .SRT',
    },
  },
  en: {
    menu: 'Menu',
    autoSaved: 'Auto saved',
    shortcuts: 'Shortcuts',
    share: 'Project',
    exportBtn: 'Export',
    player: 'Player',
    details: 'Details',
    modify: 'Modify',
    dragMaterialPrompt: 'Drag material here and start to create',
    loadSampleProject: 'Load sample project',
    saveAsPreset: 'Save as preset',
    importFilesBtn: 'Import',
    importSubtitle: 'Videos, audios, and images',
    searchPlaceholder: 'Search library...',
    cover: 'Cover',
    tabs: {
      import: 'Import',
      audio: 'Audio',
      text: 'Text',
      stickers: 'Stickers',
      effects: 'Effects',
      transitions: 'Transitions',
      captions: 'Captions',
      filters: 'Filters',
      adjustment: 'Adjustment',
    },
    menuItems: {
      newProject: 'New empty project',
      clearTimeline: 'Clear timeline',
      loadDemo: 'Restore sample project',
      importMedia: 'Import local file...',
      projectSettings: 'Project settings',
      shortcuts: 'Keyboard shortcuts',
      language: 'Language: English (switch to ES)',
    },
    detailsFields: {
      name: 'Name',
      aspectRatio: 'Aspect ratio',
      resolution: 'Resolution',
      frameRate: 'Frame rate',
      duration: 'Total duration',
      tracks: 'Active tracks',
      clipsCount: 'Timeline clips',
      arrangeLayers: 'Arrange layers',
      turnedOn: 'Turned on',
    },
    inspector: {
      video: 'Video',
      audio: 'Audio',
      speed: 'Speed',
      animation: 'Animation',
      adjustment: 'Adjustment',
      text: 'Text',
      tts: 'Text to speech',
      basic: 'Basic',
      cutout: 'Cutout',
      crop: 'Crop',
      templates: 'Templates',
      effects: 'Effects',
      mask: 'Mask',
      enhance: 'Enhance',
      transform: 'Transform',
      scale: 'Scale',
      uniformScale: 'Uniform scale',
      position: 'Position',
      rotation: 'Plane rotation',
      opacity: 'Opacity',
      blendMode: 'Blend mode',
      flip: 'Flip',
      volume: 'Volume',
      fadeIn: 'Fade in',
      fadeOut: 'Fade out',
      muteClip: 'Mute clip',
      playbackSpeed: 'Speed',
      speedNormal: 'Normal',
      speedCurve: 'Curve',
      inAnimation: 'In',
      outAnimation: 'Out',
      durationSec: 'Duration',
      brightness: 'Brightness',
      contrast: 'Contrast',
      saturation: 'Saturation',
      temperature: 'Temperature',
      exposure: 'Exposure',
      hue: 'Hue',
      vignette: 'Vignette',
      fade: 'Fade',
      reset: 'Reset',
      font: 'Font',
      size: 'Size',
      color: 'Color',
      stroke: 'Stroke',
      background: 'Background',
      shadow: 'Shadow',
      align: 'Alignment',
      intensity: 'Intensity',
      transitionDuration: 'Transition duration',
      speakPreview: 'Preview voice',
      addVoiceClip: 'Add audio to timeline',
      chromaKey: 'Chroma Key',
      chromaColor: 'Key color',
      chromaStrength: 'Strength',
      chromaFeather: 'Shadow / Feather',
      cropFrame: 'Crop frame',
      cropTop: 'Top',
      cropBottom: 'Bottom',
      cropLeft: 'Left',
      cropRight: 'Right',
      voiceEffects: 'Voice effects',
      noiseReduction: 'Reduce noise',
      normalizeAudio: 'Normalize loudness',
      keyframes: 'Keyframes',
      addKeyframe: 'Add keyframe',
      removeKeyframe: 'Remove keyframe',
      reverseClip: 'Reverse playback',
      sharpen: 'Sharpen',
      autoColor: 'Auto color',
      rotate90: 'Rotate 90°',
      fitCanvas: 'Fit canvas',
      fillCanvas: 'Fill canvas',
      beatMarkers: 'Generate beat markers',
    },
    toolbar: {
      select: 'Select tool (V)',
      blade: 'Blade split tool (B)',
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+Y)',
      split: 'Split at playhead (Ctrl+B)',
      deleteLeft: 'Delete left (Q)',
      deleteRight: 'Delete right (W)',
      delete: 'Delete (Del)',
      duplicate: 'Duplicate clip (Ctrl+D)',
      copy: 'Copy clip (Ctrl+C)',
      paste: 'Paste clip (Ctrl+V)',
      freeze: 'Freeze frame',
      reverse: 'Reverse clip',
      detachAudio: 'Detach audio',
      addMarker: 'Add marker (K)',
      addTrack: '+ Track',
      record: 'Record voiceover',
      stopRecord: 'Stop recording',
      snap: 'Main track magnet / Snap',
      ripple: 'Auto ripple',
      fitView: 'Zoom to fit',
      clearAll: 'Clear timeline',
      merge: 'Merge clips (M)',
    },
    captions: {
      addManual: '+ Add caption',
      importSrt: 'Import .SRT',
      exportSrt: 'Export .SRT',
    },
  },
};
