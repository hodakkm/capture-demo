var fs = require('fs');
var request = require('request');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

function getTask(token, id, callback){
    var httpRequest = new XMLHttpRequest();
    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState === 4) { // request is done
            if (httpRequest.status === 200) { // successfully
              // variable to hold the response text
              var response = JSON.parse(httpRequest.responseText);
              //console.log(response);
              // if still pending, call the getTask function again after 500 milliseconds
              if (response.statusMessage === "Pending"){
                setTimeout(function(){
                  // console.log('pending...');
                  getTask(token, id, callback);
                }, 500);
                  }
              // else if the processing is done, pass the response text to the callback function
              else if (response.statusMessage === "Success") {
                callback(response);   
              }
            }
        }
    };
    httpRequest.open("POST", 'https://capturestaging.concordfax.com/v1.0/task');
		httpRequest.setRequestHeader("Accept", "application/json");
		httpRequest.setRequestHeader("Content-Type", "application/json");
    httpRequest.send(JSON.stringify({taskId: id, accessToken: token}));  
}



function sendDocument(token, path, name, callback){
  
    // object that holds the info to send to Cloud Capture's /process method
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
       ACCESS_TOKEN: token} };

    // uses the request module to send the request and pass the response to the callback function 
    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      else {
        callback(JSON.parse(body));
      }
    });  
}


module.exports.getTask = getTask;
module.exports.sendDocument = sendDocument;