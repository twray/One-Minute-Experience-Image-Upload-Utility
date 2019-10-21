module.exports = {

  // Path where source images are located.
  IN_PATH: './1me-images/',

  // Temporary directory where transformed images are stored.
  OUT_PATH: './1me-images-out/',

  // Supported image file formats
  SUPPORTED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg'],

  // Your Azure CustomVision Project ID
  AZURE_CV_PROJECT_ID: '[your-azure-project-id]',

  // Your Azure CustomVision Training Key
  AZURE_CV_TRAINING_KEY: '[your-azure-training-key]',

  // Your Azure Prediction Resouce ID
  AZURE_CV_PREDICTION_RESOURCE_ID: '[your-azure-prediction-resource-id]',

  // Your Azure CustomVision Endpoint
  AZURE_CV_ENDPOINT: '[your-azure-cv-endpoint]',

  // E-mail / username to log into the Directus back-end
  DIRECTUS_EMAIL: '[your-directus-email-address]',

  // Password to log into the Directus back-end
  DIRECTUS_PASSWORD: '[your-directus-password]'

};
