$(document).ready(function () {
    console.log("pop-up")
    var stop_button = $("#stop");
    chrome.storage.local.get(['jobData'], function (result) {
        console.log("jobData", result)
        if (result.jobData && result.jobData.process_start !== "") {
            console.log("Process start is not blank:", result.jobData.process_start);
            // stop_button.css("display", "block")
            $('#skills').val(result.jobData.skills);
            $('#job_location').val(result.jobData.job_location);
            $('#job_count').val(result.jobData.job_count);
            $('#job_type').val(result.jobData.job_type);
        }
    });
    $('#submit').click(function () {
        var skills = $('#skills').val();
        var job_location = $('#job_location').val();
        var job_count = $('#job_count').val();
        var job_type = $('#job_type').val();
        var processStart = "process start";
        var min = 1;

        if (job_count < min || job_count === "") {
            alert("Please enter a number greater than or equal to " + min + " for the Number of jobs to apply.");
            $('#job_count').focus(); 
            return false; 
        }
        data = {
            skills: skills,
            job_location: job_location,
            job_count: job_count,
            job_type: job_type,
            process_start: processStart
        };
        console.log(data);
        chrome.storage.local.set({ jobData: data }, function () {
            console.log("Data saved to Chrome storage:", data);
        });
        chrome.storage.local.get(['jobData'], function (result) {
            console.log("ljd;lsdj", result)
            if (result.jobData && result.jobData.process_start !== "") {
                console.log("Process start is not blank:", result.jobData.process_start);
                // stop_button.css("display", "block")


            }
        });

        chrome.runtime.sendMessage({
            type: 'applyLinkedin',
            data: data,
        });
    });
    // $('#stop').click(function () {
    //     console.log("stop");
    //     let processStart = "";
    //     var data = {
    //         process_start: processStart
    //     };
    //     chrome.storage.local.set({ jobData: data }, function () {
    //         console.log("Data saved to Chrome storage:", data);
    //     });
    //     chrome.runtime.sendMessage({
    //         type: 'stop_background_proccess',
    //     })
    // })
});