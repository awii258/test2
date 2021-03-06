"use strict";

const Hapi = require("@hapi/hapi");
const fs = require("fs");
const axios = require("axios");
const speech = require("@google-cloud/speech");
const ffmpeg = require("fluent-ffmpeg");

const client = new speech.SpeechClient();
const PROTOCOL = "http://";
const SERVER_HOST = process.env.HOST || "localhost";
const SERVER_PORT = process.env.PORT || 3000;
const API_HOST = process.env.API_HOST || "localhost";
const API_PORT = process.env.API_PORT || 8080;

const init = async () => {
 
  // const port = process.env.PORT || 5000;
  // app.listen(port, () => {
  //   console.log("Server listening on port " + port);
  // });
  const server = Hapi.server({
    port: process.env.PORT || 5000,
    host: process.env.HOST || "0.0.0.0",
    // labels: ["api"],
    routes: {
       cors: {
        origin: [PROTOCOL + API_HOST + ':' + API_PORT]
       }
     }
  });
server.route({method:'GET',path:'/',config:{handler:async(req,res)=>{
 return new Promise((resolve) => {
resolve(JSON.stringify("Hello world"))
// payload({g:"gkajdkf"})

 })  
}}})
  server.route({
    method: "POST",
    path: "/speech",
    config: {
      handler: async (request, h) => {
        const data = request.payload;
        if (data.file) {
          const name = data.file.hapi.filename;
          const path = __dirname + "/uploads/" + name;
          const encodedPath = __dirname + "/uploads/encoded_" + name;
          const file = fs.createWriteStream(path);

          file.on("error", (err) => console.error(err));

          data.file.pipe(file);

          return new Promise((resolve) => {
            data.file.on("end", async (err) => {
              const ret = {
                filename: data.name,
                headers: data.file.hapi.headers,
              };

              ffmpeg()
                .input(path)
                .outputOptions([
                  "-f s16le",
                  "-acodec pcm_s16le",
                  "-vn",
                  "-ac 1",
                  "-ar 41k",
                  "-map_metadata -1",
                ])
                .save(encodedPath)
                .on("end", async () => {
                  const savedFile = fs.readFileSync(encodedPath);

                  const audioBytes = savedFile.toString("base64");
                  const audio = {
                    content: audioBytes,
                  };
                  const sttConfig = {
                    enableAutomaticPunctuation: false,
                    encoding: "LINEAR16",
                    sampleRateHertz: 41000,
                    languageCode: "en-US",
                    model: "default",
                  };

                  const request = {
                    audio: audio,
                    config: sttConfig,
                  };

                  const [response] = await client.recognize(request);
                  const transcription = response.results
                    .map((result) => result.alternatives[0].transcript)
                    .join("\n");

                  fs.unlinkSync(path);
                  fs.unlinkSync(encodedPath);
                  resolve(
                    JSON.stringify({ ...ret, transcript: transcription })
                  );
                });
            });
          });
        }
      },
      payload: {
        output: "stream",
        parse: true,
      },
    },
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
});

init();
