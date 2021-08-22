const config = require('./config');
const vodsListsOld = require('./vodListsOld');
const vodsLists = require('./vodLists');
const ytdl = require('youtube-dl-exec');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
const twit =  require('twit');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const T = new twit(config.twitter);

let vodsSelected = [];
let streamers = ['Antoine', 'Daniel', 'Kiddy', 'Vanessa', "Donatien"];
let sequenceByCharacter = 2;

let promises = [];

let on_heroku = false
if (process.env.ENV === "PROD")
    on_heroku = true

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function convert_time(duration) {
    let a = [duration.substring(0, 2), duration.substring(2, 4), duration.substring(4, 6)];

    let convertedDur = 0;

    convertedDur += parseInt(a[0]) * 3600;
    convertedDur += parseInt(a[1]) * 60;
    convertedDur += parseInt(a[2]);

    if (duration.length > 6)
    {
        a.push(duration.substring(6, 8));
        convertedDur += parseFloat(a[3]);
    }

    return convertedDur
}

async function downloadVideo() {
    /*ytdl(videoJson.link, options)
        .then (output => console.log(output));*/

    //verify that there is no downloads ongoing

    /*console.log('killing');
    promises.forEach(promise => function () {
        promise.kill('SIGTERM');
    })*/
    promises = [];

    let clipsLength = 5;
    vodsSelected = [];

    let streamerToPickFrom = vodsLists["Antoine"];

    let vodId = Math.floor(Math.random() * streamerToPickFrom.length); // get a random vod from the selected streamer
    //vodId = 5; //Test value for synchronizing

    //Get a random Daniel vod
    let vodToPickFrom = streamerToPickFrom[vodId];

    let randomSegment = vodToPickFrom.withCroute[Math.floor(Math.random() * vodToPickFrom.withCroute.length)];
    let minTime = (new Date(vodToPickFrom.launchTime)).getTime() / 1000 + convert_time(randomSegment.begining);
    console.log("Min Time : " + minTime);
    console.log("Min Time : " + new Date(minTime * 1000).toISOString());
    let maxTime = (new Date(vodToPickFrom.launchTime)).getTime() / 1000 + convert_time(randomSegment.end);
    console.log("Max Time : " + new Date(maxTime * 1000).toISOString());

    //Get a random time in the vod
    let randomTime = Math.floor(Math.random() * (maxTime - minTime) + minTime); //take a random spot of the video in ms
    let pickedTime = new Date(randomTime * 1000); // make it a date
    //pickedTime = new Date("2021-05-02T00:19:37.000Z"); //Test value for synchronizing
    console.log("Picked Time : " + pickedTime.toISOString());

    streamers.forEach(function (streamer) {
        vodsLists[streamer].forEach(function (vod) {
            vod.withCroute.forEach(function (item) {
                let streamerBeginingOfVod = new Date(new Date(vod.launchTime).getTime() + convert_time(item.begining) * 1000);
                let streamerEndOfVod = new Date(new Date(vod.launchTime).getTime() + convert_time(item.end) * 1000);
                if (pickedTime > streamerBeginingOfVod && pickedTime < streamerEndOfVod) {
                    vodsSelected.push(vod);
                }
            });
        });
    });

    //console.log(vodsSelected);

    if (vodsSelected.length >= 2) {

        let i = 0;
        for (let j = 0; j < sequenceByCharacter; j++) {
            for (let k = 0; k < vodsSelected.length; k++) {

                let vodClipTime = (pickedTime.getTime() - new Date(vodsSelected[k].launchTime).getTime()) / 1000;
                console.log(vodsSelected[k].url + "&t=" + Math.floor(vodClipTime));

                if (on_heroku)
                    await downloadClip(vodsSelected[k].url, vodClipTime, clipsLength, i); // Do this for weak server (heroku free plan)
                else
                    promises.push(downloadClip(vodsSelected[k].url, vodClipTime, clipsLength, i)); // Should do this for faster results
                i++;
            }
        }

        if (on_heroku)
        {
            let merging = mergeClips();
            merging.then(() => postVideo('./clip.mp4'));
        }
        else
        {
            Promise.all(promises).then(function (results) {
                let merging = mergeClips();

                //merging.then(() => postVideo('./clip.mp4'));
            });
        }
    }
    else downloadVideo();
}

function downloadClip(url, time, length, id) {
    return new Promise((resolve, reject) => {
        console.log(id + " Downloading");

        let options = {f: '22', getUrl: true, forceIpv4: true}; // 22 = 720p, 18 = 360p

        ytdl(url, options)
            .then(output => {
                ffmpeg({source: output})
                    .seekInput(time + length*id)
                    .duration(length) //seconds
                    .audioFilters('volume=2')
                    .on('error', function(err) {
                        console.log('Error ' + err.message);
                        reject('Error ' + err.message);
                        downloadVideo();
                    })
                    .on('start', function (startLine) {
                    })
                    .save('./clip' + id + '.mp4')
                    .on('end', function () {
                        console.log(id + " Downloaded");
                        resolve('done');

                        /*ffmpeg('./clip' + id + '.mp4')
                            .size('1280x720')
                            .save('./clip' + id + 'Resized.mp4')
                            .on('end', function () {
                                console.log(id + ' Resized');
                                resolve(id + ' Resized');
                            });*/ // this is to resize some clips in case they are different sizes (I don't do it because it needs too much ram for the server I use)
                    })
            })
    });
}

function mergeClips()
{
    return new Promise((resolve, reject) => {
        let mergedClip = ffmpeg();

        let i = 0;
        for (let j = 0; j < sequenceByCharacter; j++) {
            vodsSelected.forEach(function (item) {
                mergedClip.input('./clip' + i + '.mp4');
                i++;
            });
        }

        mergedClip.mergeToFile('./clip.mp4')
            .on('error', function(err) {
                console.log('Error ' + err.message);
                reject('Error ' + err.message);
            })
            .on('end', function() {
                console.log('Merged!');
                resolve('Merged!');
                i = 0;
                for (let j = 0; j < sequenceByCharacter; j++) {
                    vodsSelected.forEach(function (item) {
                        fs.unlink("./clip" + i + ".mp4", (err) => {
                            if (err) {
                                console.log("failed to delete local image:"+err);
                            } else {
                                console.log('successfully deleted local image');
                            }
                        });
                        i++
                    });
                }
            });
    })
}

function postVideo(filePath)
{
    T.postMediaChunked({ file_path: filePath }, async function (err, data, response) {
        //sleep(2000);
        if (err) { console.log("error uploading video : " + err) }
        if (data) {
            console.log("pret");
            console.log(data);

            await sleep(30000);

            let mediaIdStr = data.media_id_string;
            let meta_params = {media_id: mediaIdStr};

            T.post('media/metadata/create', meta_params, function (err, data, response) {
                if (!err) {
                 let tweetMessage = '';

                    // now we can reference the media and post a tweet (media will attach to the tweet)
                    let params = {status: tweetMessage, media_ids: [mediaIdStr]};

                    T.post('statuses/update', params, function (err, data, response) {
                        if (err) { console.log("error post tweet : " + err) }
                    })
                }
            })
        }
    });
}

function listFormats()
{
    let options = {listFormats: true};

    ytdl(vodsLists.Antoine[0].url, options)
        .then (output => {
            console.log(output);


            ytdl(vodsLists.Daniel[0].url, options)
                .then (output => {
                    console.log(output);
                })
        })
}

//listFormats();

downloadVideo();
