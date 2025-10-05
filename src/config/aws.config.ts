// AWS Configuration for Amazon Polly
// IMPORTANT: For production, use environment variables or secure credential storage
// Never commit real credentials to version control!

export const AWS_CONFIG = {
  // Option 1: Environment variables (recommended for production)
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1',

  // Option 2: For testing only - replace with your AWS credentials
  // To get these:
  // 1. Sign up for AWS Free Tier: https://aws.amazon.com/free/
  // 2. Go to IAM Console: https://console.aws.amazon.com/iam/
  // 3. Create a new user with programmatic access
  // 4. Attach the "AmazonPollyReadOnlyAccess" policy
  // 5. Save the access key and secret

  // TEMPORARY FOR TESTING (remove before committing):
  // accessKeyId: 'YOUR_ACCESS_KEY_HERE',
  // secretAccessKey: 'YOUR_SECRET_KEY_HERE',
  // region: 'us-east-1', // or your preferred region
};

// For development, you can create a .env.local file with:
// AWS_ACCESS_KEY_ID=your_key
// AWS_SECRET_ACCESS_KEY=your_secret
// AWS_REGION=us-east-1

// Validate configuration
export const isConfigured = () => {
  return AWS_CONFIG.accessKeyId !== '' && AWS_CONFIG.secretAccessKey !== '';
};

// AWS Polly pricing (as of 2025):
// - Standard voices: $4 per 1 million characters
// - Neural voices: $16 per 1 million characters
// - Free tier: 5 million standard / 1 million neural characters per month (first 12 months)

// Regions that support NEURAL voices (high quality)
export const NEURAL_SUPPORTED_REGIONS = {
  US_EAST_1: 'us-east-1',          // N. Virginia (recommended for US)
  US_WEST_2: 'us-west-2',          // Oregon
  EU_WEST_1: 'eu-west-1',          // Ireland (recommended for EU)
  EU_CENTRAL_1: 'eu-central-1',    // Frankfurt
  EU_WEST_2: 'eu-west-2',          // London
  CA_CENTRAL_1: 'ca-central-1',    // Canada
  AP_SOUTHEAST_1: 'ap-southeast-1', // Singapore
  AP_SOUTHEAST_2: 'ap-southeast-2', // Sydney
  AP_NORTHEAST_1: 'ap-northeast-1', // Tokyo
  AP_NORTHEAST_2: 'ap-northeast-2', // Seoul
};

// Regions that DON'T support neural voices (will use standard voices)
// eu-north-1 (Stockholm), eu-south-1 (Milan), me-south-1 (Bahrain), etc.
// If you're in these regions, use the closest supported region instead