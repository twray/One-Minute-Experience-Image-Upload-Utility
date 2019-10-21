### Introduction

A simple utility for publishing artworks to the Directus back-end, and uploading
those images to the Azure CustomVision API. This allows you to easily publish
and test the image recognition capabilities of the One Minute Experience mobile
app without the need to manually add images to the Directus database and
CustomVision back-end.

### Installation

- Clone the repository
- run `npm install`.
- Rename `config-sample.js` to `config.js`.
- Within `config.js`, update the configuration fields as required. You will need
  to supply your CustomVision project and training keys, and your Directus
  log-in credentials.

### Usage

- To upload an artwork to Directus / Azure CustomVision, place an image file
  of the artwork within the `1me-images` directory. Then, run `npm start`.
  Follow the prompts.
