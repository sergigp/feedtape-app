# Sherpa ONNX Model Setup Guide

The TTS model files are not committed to git due to their size (78MB). Follow these steps to download and configure them.

---

## Step 1: Download Model Files

### English Model (Required)

Download the Piper VITS English model:

```bash
cd /tmp
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2
tar -xjf vits-piper-en_US-lessac-medium.tar.bz2
```

This extracts:
- `en_US-lessac-medium.onnx` (63MB) - The neural TTS model
- `en_US-lessac-medium.onnx.json` (5KB) - Model config
- `tokens.txt` (1KB) - Token vocabulary
- `espeak-ng-data/` - Phoneme data (shared across languages)

### Spanish Model (Optional)

Download the Piper VITS Spanish model:

```bash
cd /tmp
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_ES-sharvard-medium.tar.bz2
tar -xjf vits-piper-es_ES-sharvard-medium.tar.bz2
```

This extracts:
- `es_ES-sharvard-medium.onnx` (63MB)
- `es_ES-sharvard-medium.onnx.json` (5KB)
- `tokens.txt` (1KB)
- `espeak-ng-data/` (same directory as English)

---

## Step 2: Copy Models to iOS Project

Create the models directory structure:

```bash
cd /path/to/feedtape/app
mkdir -p ios/feedtapeapppolly/models/en
mkdir -p ios/feedtapeapppolly/models/es
mkdir -p ios/feedtapeapppolly/models/espeak-ng-data
```

Copy the English model files:

```bash
cp /tmp/vits-piper-en_US-lessac-medium/en_US-lessac-medium.onnx ios/feedtapeapppolly/models/en/
cp /tmp/vits-piper-en_US-lessac-medium/en_US-lessac-medium.onnx.json ios/feedtapeapppolly/models/en/
cp /tmp/vits-piper-en_US-lessac-medium/tokens.txt ios/feedtapeapppolly/models/en/
cp -r /tmp/vits-piper-en_US-lessac-medium/espeak-ng-data/* ios/feedtapeapppolly/models/espeak-ng-data/
```

Copy the Spanish model files (if downloaded):

```bash
cp /tmp/vits-piper-es_ES-sharvard-medium/es_ES-sharvard-medium.onnx ios/feedtapeapppolly/models/es/
cp /tmp/vits-piper-es_ES-sharvard-medium/es_ES-sharvard-medium.onnx.json ios/feedtapeapppolly/models/es/
cp /tmp/vits-piper-es_ES-sharvard-medium/tokens.txt ios/feedtapeapppolly/models/es/
# Note: espeak-ng-data is shared, already copied from English model
```

---

## Step 3: Add Models to Xcode Project

**IMPORTANT:** The model files must be added to the Xcode project so they're bundled with the app.

### 3.1 Open the Project

```bash
open ios/feedtapeapppolly.xcworkspace
```

### 3.2 Add Models Folder to Xcode

1. In the **left sidebar** (Project Navigator), right-click on the `feedtapeapppolly` folder
2. Select **"Add Files to feedtapeapppolly..."**
3. Navigate to `ios/feedtapeapppolly/models/`
4. **IMPORTANT:** Before clicking "Add", configure these options:
   - ✅ **"Create folder references"** (NOT "Create groups")
   - ✅ **Add to targets:** Check `feedtapeapppolly`
   - ✅ **Copy items if needed:** Unchecked (files are already in the right place)
5. Click **"Add"**

### 3.3 Verify Models Are in Bundle Resources

1. In Xcode, select the **feedtapeapppolly** project (blue icon at the top of the sidebar)
2. Select the **feedtapeapppolly** target
3. Go to the **"Build Phases"** tab
4. Expand **"Copy Bundle Resources"**
5. **Verify you see:**
   - `models/` (folder reference with blue folder icon)

If you see individual files instead of a folder reference, you added them wrong - delete and re-add using "Create folder references".

### 3.4 Build the App

Close Xcode (important!) and build:

```bash
npx expo run:ios
```

**Why close Xcode?** Opening Xcode 16 can upgrade the project file format, which causes CocoaPods compatibility issues. Only open Xcode when necessary for adding resources.

---

## Troubleshooting

### "Model file not found" Error

**Symptom:** Logs show `--vits-model: 'models/en/...' does not exist`

**Solution:**
1. Verify models are in `ios/feedtapeapppolly/models/`
2. Check Xcode "Copy Bundle Resources" contains the `models/` folder
3. Make sure you used "Create folder references" (blue folder icon), not "Create groups" (yellow folder icon)

### Models Not in App Bundle

**Symptom:** Initialization works but generation fails with file not found

**Solution:**
1. Delete the app from simulator: Long-press app icon → Remove App
2. Clean build: `rm -rf ios/build`
3. Rebuild: `npx expo run:ios`

### Large Clone/Pull Times

**Note:** Model files are gitignored and won't slow down git operations. Each developer must download and configure models locally using these instructions.

---

## Quick Start Summary

```bash
# Download models
cd /tmp
curl -LO https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2
tar -xjf vits-piper-en_US-lessac-medium.tar.bz2

# Copy to project
cd /path/to/feedtape/app
mkdir -p ios/feedtapeapppolly/models/{en,es,espeak-ng-data}
cp /tmp/vits-piper-en_US-lessac-medium/en_US-lessac-medium.* ios/feedtapeapppolly/models/en/
cp /tmp/vits-piper-en_US-lessac-medium/tokens.txt ios/feedtapeapppolly/models/en/
cp -r /tmp/vits-piper-en_US-lessac-medium/espeak-ng-data/* ios/feedtapeapppolly/models/espeak-ng-data/

# Add to Xcode (see Step 3.2 above)
open ios/feedtapeapppolly.xcworkspace
# Right-click feedtapeapppolly → Add Files → models/ → Create folder references → Add

# Build
npx expo run:ios
```

---

## Model File Structure

After setup, your directory should look like this:

```
ios/feedtapeapppolly/models/
├── en/
│   ├── en_US-lessac-medium.onnx (63MB)
│   ├── en_US-lessac-medium.onnx.json (5KB)
│   └── tokens.txt (1KB)
├── es/ (optional)
│   ├── es_ES-sharvard-medium.onnx (63MB)
│   ├── es_ES-sharvard-medium.onnx.json (5KB)
│   └── tokens.txt (1KB)
└── espeak-ng-data/ (shared)
    ├── phondata
    ├── phonindex
    ├── phontab
    ├── intonations
    ├── *_dict (language dictionaries)
    ├── lang/ (language-specific data)
    └── voices/ (voice variants)
```

**Total size:** ~78MB (English only) or ~140MB (English + Spanish)
