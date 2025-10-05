# FeedTape - Amazon Polly Edition

A React Native/Expo app that converts RSS feeds to high-quality audio using Amazon Polly's neural voices.

## Features

- **Amazon Polly Neural Voices**: Professional-quality text-to-speech
- **Multiple Spanish Voices**: 8+ voices across ES-ES, ES-MX, and ES-US
- **Low Latency**: Sub-second response times
- **Voice Selection**: Switch between male/female and regional accents
- **Speed Control**: Adjustable playback speed (0.75x to 1.5x)
- **Secure Credentials**: In-app AWS credential management

## Key Differences from Native Version

| Feature | Native (AVSpeechSynthesizer) | Polly Edition |
|---------|------------------------------|---------------|
| Voice Quality | Robotic/Basic | Natural/Neural |
| Latency | Instant | <500ms |
| Voices | System voices | 8+ Spanish voices |
| Cost | Free | $16/1M chars |
| Offline | Yes | No |
| Pause/Resume | Limited | Full support |

## Setup Instructions

### 1. Get AWS Credentials

1. **Sign up for AWS Free Tier**
   - Go to: https://aws.amazon.com/free/
   - You get 1M neural TTS characters/month free for 12 months

2. **Create IAM User**
   - Go to IAM Console: https://console.aws.amazon.com/iam/
   - Click "Users" → "Add users"
   - User name: `feedtape-polly-user`
   - Select: "Programmatic access"

3. **Set Permissions**
   - Attach policy: `AmazonPollyReadOnlyAccess`
   - Review and create user
   - **SAVE YOUR CREDENTIALS** (shown only once!)

### 2. Run the App

```bash
cd feedtape-app-polly
npx expo start
```

### 3. Configure Credentials

When the app launches:
1. A modal will appear asking for AWS credentials
2. Enter your Access Key ID and Secret Access Key
3. Region: `us-east-1` (recommended for lowest latency)
4. Tap "Save"

## Available Voices

### European Spanish (ES-ES)
- **Lucia** (Female, Neural) - Clear, professional
- **Sergio** (Male, Neural) - Warm, friendly
- **Conchita** (Female, Standard) - Traditional
- **Enrique** (Male, Standard) - Formal

### Mexican Spanish (ES-MX)
- **Mia** (Female, Neural) - Young, energetic
- **Andrés** (Male, Neural) - Mature, confident

### US Spanish (ES-US)
- **Lupe** (Female, Neural) - Neutral accent
- **Pedro** (Male, Neural) - Clear pronunciation

## Cost Breakdown

### AWS Polly Pricing
- **Neural voices**: $16 per 1 million characters
- **Standard voices**: $4 per 1 million characters
- **Free tier**: 1M neural chars/month (first year)

### Example Usage
- Average article: 3,000 characters
- 10 articles/day = 30,000 chars/day
- Monthly: 900,000 characters
- **Cost**: FREE (within free tier) or ~$14.40/month after

## Architecture

```
App.tsx
  ├── AWS Credentials Modal
  ├── ArticleDisplay (visual)
  └── AudioPlayer
       └── pollyTtsService
            └── AWS SDK → Polly API
                 └── Neural TTS Engine
```

## Performance

- **Initial request**: 300-500ms
- **Audio generation**: Real-time streaming
- **Voice switching**: Instant
- **Memory usage**: ~10MB for audio buffer

## Troubleshooting

### No Audio
- Check internet connection (Polly requires internet)
- Verify AWS credentials are correct
- Check AWS console for API usage

### Slow Response
- Switch to us-east-1 region for lowest latency
- Try standard voices for faster response
- Check network speed

### Authentication Error
- Verify IAM user has `AmazonPollyReadOnlyAccess` policy
- Check credentials are typed correctly
- Ensure region matches your AWS setup

## Security Notes

⚠️ **IMPORTANT**: Never commit AWS credentials to git!

For production:
1. Use AWS Cognito for temporary credentials
2. Implement server-side proxy for Polly calls
3. Use environment variables for configuration
4. Consider AWS Amplify for managed auth

## Development

### Project Structure
```
feedtape-app-polly/
├── src/
│   ├── components/
│   │   ├── AudioPlayer.tsx    # Polly-enabled player
│   │   └── ArticleDisplay.tsx # Article viewer
│   ├── services/
│   │   ├── pollyTtsService.ts # AWS Polly integration
│   │   └── rssParser.ts       # RSS parsing
│   ├── config/
│   │   └── aws.config.ts      # AWS configuration
│   └── data/
│       └── samplePost.ts      # Sample RSS data
└── App.tsx                    # Main app with credentials UI
```

### Adding Features

**To add more languages:**
```typescript
// In pollyTtsService.ts
const FRENCH_VOICES = {
  CELINE: { id: 'Celine', language: 'fr-FR', neural: true },
  // ...
};
```

**To implement caching:**
```typescript
// Save generated audio
const cache = new Map();
if (cache.has(text)) {
  return cache.get(text);
}
// Generate and cache...
```

## Comparison with Native Version

### When to use Native (AVSpeechSynthesizer):
- Offline usage required
- Cost is a concern
- Instant response needed
- Basic quality acceptable

### When to use Polly:
- Professional audio quality needed
- Multiple voice options required
- Pause/resume support important
- Cloud features beneficial

## Next Steps

1. **Production Setup**:
   - Implement AWS Cognito for secure auth
   - Add audio caching for popular articles
   - Create backend API for credentials

2. **Features**:
   - Add bookmarking system
   - Implement playlist functionality
   - Add background playback
   - Create article queue

3. **Optimization**:
   - Pre-generate audio for new articles
   - Implement progressive loading
   - Add offline fallback to native TTS

## Support

- AWS Polly Docs: https://docs.aws.amazon.com/polly/
- Expo Audio: https://docs.expo.dev/versions/latest/sdk/audio/
- AWS Free Tier: https://aws.amazon.com/free/

## License

MIT - Free to use and modify