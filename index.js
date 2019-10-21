const {
  createCanvas,
  loadImage,
  Image
} = require('canvas');
const {
  degreesToRadians,
  sleep,
  chunker
} = require('./util');
const inquirer = require('inquirer');
const axios = require('axios');
const fs = require('fs');
const base64 = require('file-base64');
const path = require('path');
const {
  IN_PATH,
  OUT_PATH,
  SUPPORTED_IMAGE_EXTENSIONS,
  AZURE_CV_PROJECT_ID,
  AZURE_CV_TRAINING_KEY,
  AZURE_CV_PREDICTION_RESOURCE_ID,
  AZURE_CV_ENDPOINT,
  DIRECTUS_EMAIL,
  DIRECTUS_PASSWORD
} = require('./config');

const TrainingApiClient = require("@azure/cognitiveservices-customvision-training");

const log = console.log;
const err = console.error;

const main = async () => {

  const imageFileQuestions = [{
    type: 'input',
    name: 'image_file',
    message: 'What is the name of the image file?'
  }];

  const imageFileAnswers = await inquirer.prompt(imageFileQuestions);
  const imageFilename = imageFileAnswers.image_file;

  if (
    true || // temp
    fs.existsSync(IN_PATH + imageFilename) &&
    SUPPORTED_IMAGE_EXTENSIONS.includes(
      path.extname(IN_PATH + imageFilename).toLowerCase()
    )
  ) {

    log(`Verified image file ${imageFilename}`);

    const metadataQuestions = [{
      type: 'input',
      name: 'title',
      message: 'What is the title of the work?'
    }, {
      type: 'input',
      name: 'year',
      message: 'What year was the work made in? (optional)'
    }, {
      type: 'input',
      name: 'artist_name',
      message: 'What is the name of the artist? (optional)'
    }, {
      type: 'input',
      name: 'artist_nationality',
      message: 'What is the nationality of the artist? (optional)'
    }];

    const artwork = await inquirer.prompt(metadataQuestions);

    console.log(`\nCreating training data-set ... `);

    await processImage('piet-mondrian-the-red-tree.jpg');

    console.log(`\nAdding work ${artwork.artist_name}: ${artwork.title} to database ... `);

    await addToDatabase(artwork, imageFilename);

    await uploadImagesToCustomVision(199, 'Piet Mondrian', 'The Red Tree');

  } else {

    err(`${imageFilename} is not a valid image file.`);

  }

};

const addToDatabase = async (artwork, imageFilename, tagId) => {

  console.log();
  console.log('NOTE: The OneMinuteExperience extension must be disabled in');
  console.log('order for this to work. Please ensure that you re-enable all');
  console.log('extensions after doing this.');
  console.log();

  // Add artwork to Directus DB

  try {

    // Authenticate, retrieve access token

    const authenticationResponse = await axios.post(
      'https://modgift.itu.dk/1mev2/_/auth/authenticate', {
        email: DIRECTUS_EMAIL,
        password: DIRECTUS_PASSWORD
      }
    );

    const token = authenticationResponse.data.data.token;
    const authHeader = {
      'Authorization': 'Bearer ' + token
    };

    // Upload its image

    const imageData = await new Promise(resolve => {
      base64.encode(IN_PATH + imageFilename, (err, data) => resolve(data));
    });

    const uploadImageResponse = await axios.post(
      'https://modgift.itu.dk/1mev2/_/files',
      {
        filename: imageFilename,
        data: imageData
      },
      {headers: authHeader}
    );

    const imageFileID = uploadImageResponse.data.data.id;

    // Add the artwork to the database

    const createArtworkResponse = await axios.post(
      'https://modgift.itu.dk/1mev2/_/items/artwork',
      {...artwork, status: 'published', image: imageFileID},
      {headers: authHeader}
    );

  } catch (e) {
    console.log(e);
  }

}

const processImage = async (filename) => {

  const image = await loadImage(IN_PATH + filename);

  // Scale the artwork at different sizes, and with varying degrees of rotation,
  // as the user would likely be viewing the artwork from varying distances,
  // and with rotations that are slightly off-center.

  const scaleFactors = [90, 60, 30];
  const rotations = [0, 30, 60, 90, 270, 300, 330];

  scaleFactors.forEach(scaleFactor => {

    rotations.forEach(rotation => {

      const { canvas, context } = createCanvasAndContextFromImage(image);

      const transforms = {
        scale: scaleFactor,
        rotate: rotation
      };
      applyImageTransforms(image, canvas, context, transforms);

      try {
        saveImage(canvas, OUT_PATH + filename, getFileSuffix(transforms));
      } catch (e) {
        log('A problem occurred while saving the image.');
        log(e);
      }

    });

  });


  // The user would likely photograph the artwork from a slight angle, i.e.,
  // slightly to either side, or perhaps even from the bottom or top. Therefore,
  // we generate projections of the work from as seen from the top, bottom, left
  // and right, as seen at varying degrees angles with respect to the center
  // of the artwork.

  const perspectives = ['top', 'bottom', 'left', 'right'];
  const perspectiveScales = [90, 80, 70, 60];

  perspectives.forEach(perspective => {

    perspectiveScales.forEach(perspectiveScale => {

      const { canvas, context } = createCanvasAndContextFromImage(image);

      const transforms = {
        perspective: {type: perspective, scale: perspectiveScale}
      };
      applyImageTransforms(image, canvas, context, transforms);

      try {
        saveImage(canvas, OUT_PATH + filename,getFileSuffix(transforms));
      } catch (e) {
        log('A problem occurred while saving the image.');
        log(e);
      }

    });

  });

}

const applyImageTransforms = (image, canvas, context, transforms = {}) => {

  if (!context || !image) return;

  // Initialise the canvas state, set a default background colour, and
  // ensure that all transformation are set with respect to the center
  // of the image

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, image.width, image.height);
  context.translate(image.width / 2, image.height / 2);
  const correctedOrigin = [0 - image.width / 2, 0 - image.height / 2];

  // We can either apply a perspective transform OR we can apply any combination
  // of scale / rotation transform. We cannot, however, apply both.

  if (transforms.perspective) {

    const scaleFactor = transforms.perspective.scale / 100;

    if (
      transforms.perspective.type === 'top' ||
      transforms.perspective.type === 'bottom'
    ) {

      for (let i = 0; i < image.height; i++) {

        let offsetSlope;
        if (transforms.perspective.type === 'top') {
          offsetSlope = (i / image.height);
        } else if (transforms.perspective.type === 'bottom') {
          offsetSlope = ((image.height - i) / image.height);
        }

        const offset = image.width * (1 - scaleFactor) * offsetSlope;
        const resizedWidth = image.width - offset;
        context.drawImage(
          image,
          0, i,
          image.width, 1,
          (offset / 2) - (image.width / 2), i - (image.height / 2),
          resizedWidth, 1
        );

      }

      let renderedImage = new Image();
      renderedImage.src = canvas.toDataURL('image/jpeg');
      context.fillRect(...correctedOrigin, image.width, image.height);
      context.scale(1, scaleFactor);
      context.drawImage(renderedImage, ...correctedOrigin, renderedImage.width, renderedImage.height);

    }

    if (
      transforms.perspective.type === 'right' ||
      transforms.perspective.type === 'left'
    ) {

      for (let i = 0; i < image.width; i++) {

        let offsetSlope;
        if (transforms.perspective.type === 'right') {
          offsetSlope = (i / image.width);
        } else if (transforms.perspective.type === 'left') {
          offsetSlope = ((image.width - i) / image.width);
        }

        const offset = image.height * (1 - scaleFactor) * offsetSlope;
        const resizedHeight = image.height - offset;
        context.drawImage(
          image,
          i, 0,
          1, image.height,
          i - (image.width / 2), (offset / 2) - image.height / 2,
          1, resizedHeight
        );

      }

      let renderedImage = new Image();
      renderedImage.src = canvas.toDataURL('image/jpeg');
      context.fillRect(...correctedOrigin, image.width, image.height);
      context.scale(scaleFactor, 1);
      context.drawImage(renderedImage, ...correctedOrigin, renderedImage.width, renderedImage.height);

    }

  } else {

    if (transforms.rotate) {
      context.rotate(degreesToRadians(transforms.rotate));
    }

    if (transforms.scale) {
      context.scale(transforms.scale / 100, transforms.scale / 100);
    }

    context.drawImage(image, ...correctedOrigin);

  }

  return context;

};

const getFileSuffix = (transforms = {}) => {

  return Object.keys(transforms).map(transformProperty => {
    if (transformProperty === 'perspective') {
      return `${transformProperty}-${getFileSuffix(transforms[transformProperty])}`;
    } else {
      return `${transformProperty}-${transforms[transformProperty]}`;
    }
  }).join('-');

};

const createCanvasAndContextFromImage = (image) => {

  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  return { canvas, context };

};

const saveImage = (canvas, filepath, suffix) => {

  let filename;
  if (suffix) {
    const fileComponents = filepath.split('.');
    const fileExtension = fileComponents.pop();
    filename = `${fileComponents.join('.')}-${suffix}.${fileExtension}`;
  } else {
    filename = filepath;
  }

  const stream = canvas.createJPEGStream({
    quality: 0.9,
    chromaSubSampling: false
  });

  const out = fs.createWriteStream(filename);
  stream.pipe(out);

};

const uploadImagesToCustomVision = async (id, artist, title) => {

  const trainer = new TrainingApiClient.TrainingAPIClient(
    AZURE_CV_TRAINING_KEY,
    AZURE_CV_ENDPOINT
  );

  const tag = await trainer.createTag(
    AZURE_CV_PROJECT_ID,
    `${id}: ${artist} - ${title}`
  );
  const tagId = tag.id;

  let fileUploads  = [];
  const files = fs.readdirSync(OUT_PATH);

  const filesAsChunks = chunker(files, 10);

  for (let i = 0; i < filesAsChunks.length; i++) {

    const fileUploads = [];

    filesAsChunks[i].forEach(file => {
      fileUploads.push(trainer.createImagesFromData(
        AZURE_CV_PROJECT_ID,
        fs.readFileSync(OUT_PATH + file),
        {tagIds: [tagId]}
      ));
    });

    await Promise.all(fileUploads);
    await sleep(1500);

  }

  let trainingIteration = await trainer.trainProject(AZURE_CV_PROJECT_ID);

  while (trainingIteration.status === 'Training') {
    await sleep(1500);
    trainingIteration = await trainer.getIteration(
      AZURE_CV_PROJECT_ID,
      trainingIteration.id
    )
  }

  const iterations = await trainer.getIterations(AZURE_CV_PROJECT_ID);
  const testingIteration = iterations.find(iteration => iteration.publishName === 'testing');

  if (testingIteration) {

    const testingIterationId = testingIteration.id;

    await trainer.unpublishIteration(
      AZURE_CV_PROJECT_ID,
      testingIterationId
    );

    await trainer.deleteIteration(
      AZURE_CV_PROJECT_ID,
      testingIterationId
    );

  }

  await trainer.publishIteration(
    AZURE_CV_PROJECT_ID,
    trainingIteration.id,
    'testing',
    AZURE_CV_PREDICTION_RESOURCE_ID
  );

}

try {
  main();
} catch (e) {
  log('An error occurred while processing the images');
  log(e);
}
