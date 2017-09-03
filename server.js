var fs = require('fs');
var FormData = require('form-data');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var express = require('express');
var request = require("request");
var captureFunctions = require('./capture');

const uploadFolder = './uploads/';

// the multer module handles uploading
var multer  = require('multer')

// tells multer to store the uploaded file in the /uploads folder and prepend the original name with the date/time stamp
var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './uploads');
  },
  filename: function (req, file, callback) {
    callback(null, Date.now() + '-' + file.originalname);
  }
});

var upload = multer({ storage : storage});


var app = express();
app.set('view engine', 'ejs');
app.use('/uploads', express.static(__dirname + '/uploads'));

var filename, filesize;
var myToken = "60446267-28ae-4573-a167-1175260d2b7c"; // should use concordSignin function to get ACCESS_TOKEN but this will work for test environment

if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         //console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    //console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });
  
// route handler to load the html for the home page
app.route('/').get(function(req, res) {
      res.sendFile(process.cwd() + '/views/index.html');
    })

// route handler to load the html for the upload page
app.route("/upload").get(function(req, res) {
  
  // deletes previously uploaded file(s) from the ./uploads folder
  fs.readdirSync(uploadFolder).forEach(file => {  
    fs.unlink(uploadFolder + '/' + file);
  });
  
  res.sendFile(process.cwd() + '/views/upload.html');
});

// route handler to return the filename and file size info as JSON
app.route("/process").post(upload.single('ocrFileUpload'), function(req, res) {
    
  //console.log(req.file);
  //console.log(req);
  filename = req.file.originalname;
  filesize = req.file.size;
  //console.log('filename: ' + filename);
  
  // variable pointing to the path of the uploaded file
  var filePath = req.file.path; 
    

  // pass the document info to the sendDocument function to use Cloud Capture's /process method
  captureFunctions.sendDocument(myToken, filePath, filename, function(result){
    //console.log('Finished with submitting ' + filename);
    //console.log(result);
    //console.log('\nThe taskid is: ' + result.taskId);
    
        // calls getTask and assigns the resulting values to the patientName, DOB, and SSN variables
        captureFunctions.getTask(myToken, result.taskId, function(result){
          var payload = result.payload;
          var patientName, DOB, SSN;
          
          if(payload[0].pages[0].annotations.DOB){
            DOB = payload[0].pages[0].annotations.DOB;
          } else {
            DOB = "-";
          };
          
          if(payload[0].pages[0].annotations.NAME){
            patientName = payload[0].pages[0].annotations.NAME;
          } else {
            patientName = "-";
          }

          if(payload[0].pages[0].annotations.SSN){
            SSN = payload[0].pages[0].annotations.SSN;
          } else {
            SSN = "-";
          }
          
        var plainText = "";  
        // assigns page's segments to an array to work with
        var myArray = payload[0].pages[0].segments;

        // iterates through the segments
        for (var i = 0; i < myArray.length; i++){
          // iterates through the lines in each segment
          for (var j = 0; j < myArray[i].lines.length; j++){
            // iterates through the words in each line
            for (var k = 0; k < myArray[i].lines[j].words.length; k++){
              // adds the word's text and a space to myString
              plainText += myArray[i].lines[j].words[k].text;
              plainText += ' ';
            }
          }
        }
          
          // pass annotations to the ejs template
          res.render('result', {patientName: patientName, DOB: DOB, SSN: SSN, filePath: ("/" + filePath), plainText: plainText})
        })
  });   
});


    
// Respond not found to all the wrong routes
app.use(function(req, res, next){
      res.json('Page not found');   
  res.status(404);
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})


app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

function getTask(id, callback){
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState === 4) { // request is done
            if (httpRequest.status === 200) { // successfully
              // variable to hold the response text
              var response = JSON.parse(httpRequest.responseText);
              console.log(response);
              // if still pending, call the getTask function again after 1 second
              if (response.statusMessage === "Pending"){
                setTimeout(function(){
                  console.log('pending...');
                  getTask(id, callback);
                }, 1000);
                  }
              // else if the processing is done, pass the response text to the callback function
              else if (response.statusMessage === "Success") {
                callback(response); // we're calling our method  
              }
            }
        }
    };
    httpRequest.open("POST", 'https://capturestaging.concordfax.com/v1.0/task');
		httpRequest.setRequestHeader("Accept", "application/json");
		httpRequest.setRequestHeader("Content-Type", "application/json");
    httpRequest.send(JSON.stringify({taskId: id, accessToken: myToken}));  
}



function sendDocument(path, name, callback){
  
     var options = { method: 'POST',
      url: 'https://capturestaging.concordfax.com/v1.0/process',
      headers: 
       { 'cache-control': 'no-cache',
         accept: 'application/json',
         'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' },
      formData: 
       { file_1: 
        { value: fs.createReadStream(path),
          options: { filename: name, contentType: null } },
       ACCESS_TOKEN: '60446267-28ae-4573-a167-1175260d2b7c' } };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      else {
        callback(JSON.parse(body));
      }
      
    });  

}


function convertTif(path){
  console.log('converting TIF: ' + path);
  var tiffs = ["./" + path];
  console.log(tiffs);
  converter.convertArray(path, location);
}

