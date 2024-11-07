// const siteUrl = "https://sachinkumar.me/quickapply/public/";
const siteUrl = "https://quickapplyforjobs.com/";

//const siteUrl = "http://127.0.0.1:8000/";
let authToken = "";
let userId = null;

// let apiBaseUrl = `https://sachinkumar.me/quickapply/public/api/`;
const apiBaseUrl = `https://quickapplyforjobs.com/api/`;

//let apiBaseUrl = `http://127.0.0.1:8000/api/`;
let jobCount;
let resume;
let additionalInfo;
let currentIndex = 0;
let currentTabId;
var chatgpt_json = {
  "answers":
  {
    "current_salary": "50000",
    "expected_salary": "70000",
    "experience": "8",
  }
};

// Function to get the user ID from cookies
function getCookies(domain, name, callback) {
  chrome.cookies.get({ "url": domain, "name": name }, function (cookie) {
    // console.log(cookie);
    if (callback) {
      if (cookie && cookie.value) {
        callback(cookie.value);
      } else {
        chrome.storage.local.set({ usertoken: '' }, function () { });
      }
    }
  });
}

// Oninstall though window.open can be blocked by popup blockers
chrome.runtime.onInstalled.addListener(function () {
  chrome.alarms.create('forActiveState', { periodInMinutes: 1 / 60 });
  reloadAllTabsOnStartUp();
  return true;
});

chrome.runtime.onStartup.addListener(function () {
  reloadAllTabsOnStartUp();
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name == 'forActiveState') {
    getCookies(siteUrl, "user_id", function (id) {
      chrome.storage.local.set({ usertoken: id }, function () {
        userId = id;
      });
      console.log("id", id);
    });
    return true;
  }
});

// Reload Tabs on startup and on alarms
function reloadAllTabsOnStartUp() {
  chrome.windows.getAll({ populate: true }, function (windows) {
    windows.forEach(function (window) {
      if (window.type == 'normal') {
        window.tabs.forEach(function (tab) {
          if (tab.url && (tab.url.indexOf('linkedin') != -1 || tab.url.indexOf('quickapply') != -1)
          ) {
            chrome.tabs.reload(tab.id);
          }
        });
      }
    });
  });
};

// Listen for message to reload current page
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // save apply Linkedin data
  if (message.type == 'applyLinkedin') {

    let data = message.data;
    console.log("data-new", data)
    openLinkedinTab(data);

    // getCookies(siteUrl, "user_id", function (id) {
    //     user_id = id;
    //     console.log(user_id);
    //     if(user_id != undefined && user_id != ''){
    //         data.user_id = parseInt(user_id);
    //         console.log("new-data",data);
    //         const init = {
    //           method: 'GET',
    //           async: true,
    //           headers: {
    //             'Content-Type': 'application/json',
    //           }
    //         };

    //        const url = `https://quickapplyforjobs.com/api/user/${user_id}`;
    //       // const url = `https://apis.alturaautomotive.com/demo/public/api/user/6`;
    //        console.log(url);
    //         fetch(url, init)
    //         .then(response => response.json())
    //         .then(response => {
    //           console.log("response11111SS",response);
    //           if (response) {
    //             resume = response.data.resume_details;
    //             additionalInfo = response.data;

    //           } else {
    //             console.warn('Data not saved');
    //           }
    //         }); 
    //     }
    //   })
  } else if (message.type == 'resumeUrl') {
    console.log(message);
    let tabId = sender.tab.id;
    let fileUrl = message.url;
    fetchData(tabId, fileUrl);
  } else if (message.type == "callGPT") {

    var question = message.qesArray;
    console.log("GPT messag recieved");
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({ question: question }),
      redirect: 'follow'
    };
    var GptanswersUrl = apiBaseUrl + "answerai";
    fetch(GptanswersUrl, requestOptions)
      .then(response => response.text())
      .then(result => {
        console.log(result)
        //  console.log('message.formfield', message.formfield);
        chrome.tabs.sendMessage(sender.tab.id, { from: 'background', subject: 'responseBG', result: result }, function () {
          // bbody console.log();
        });
      })
      .catch(error => console.log('error', error));


    return true;
  } else if (message.type == "updateTab") {

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      currentTabId = tabs[0].id;
      console.log(currentTabId);
      currentIndex = 0;
      var allJobLinks = message.linksArray;
      chrome.storage.local.set({ allJobLinks: allJobLinks, currentIndex: currentIndex }, function () {
        console.log(allJobLinks, "all jobs limks");
        console.log(currentTabId, "current tab id");
        updateTabUrl(allJobLinks, currentTabId, currentIndex);
        sendResponse({ response: "Tab update process started" });
      });

    })
  } else if (message.type == "getAnswersFromchatgpt") {
    sendResponse(chatgpt_json);
    return true;
  } else if (message.type == "stop_background_proccess") {
    chrome.runtime.reload();
  } else if (message.type == "stop_linkedIn_proccess") {
    chrome.tabs.remove(sender.tab.id)
  } else if (message.type == "goingToNextJob") {
    console.log("jjdjdjjd")
    chrome.storage.local.get(['currentIndex', 'currentTabId', 'allJobLinks'], function (result) {
      console.log("currentIndex", result.currentIndex)
      console.log("currentTabId", result.currentTabId)
      console.log("allJobLinks", result.allJobLinks)
      let increaseCurrentIndex = result.currentIndex + 1
      chrome.storage.local.set({ currentIndex: increaseCurrentIndex }, function () {
        updateTabUrl(result.allJobLinks, result.currentTabId, increaseCurrentIndex);
      });
    });

  }
});


// Function to update the tab URL and schedule the next update
function updateTabUrl(allJobLinks, currentTabId, currentIndex) {
  chrome.storage.local.get(['jobData'], function (result) {
    let jobCount = parseInt(result.jobData.job_count);
    console.log(allJobLinks, currentIndex, currentTabId, jobCount, "update tab urls func");
    if (currentIndex < allJobLinks.length) {
      console.log(currentIndex, allJobLinks.length, "length check");

      console.log("currentIndex", currentIndex)
      console.log("jobCount", jobCount)

      console.log("ljd;lsdj", result.jobData.job_count)

      // Check if currentIndex equals allJobLinks.length, and if so, skip the update and go to the else condition.
      if (currentIndex == jobCount) {
        console.log("All URLs updated");
        let processStart = "";
        var data = {
          process_start: processStart
        };
        chrome.storage.local.set({ jobData: data }, function () {
          console.log("Data saved to Chrome storage:", data);
          chrome.tabs.sendMessage(currentTabId, { action: "processComplete" })
        });
        return;
      }


      if (allJobLinks[currentIndex]) {
        const newUrl = allJobLinks[currentIndex];

        console.log("newUrl", `https://www.linkedin.com${newUrl}`)
        // return false;


        // Update the tab URL
        chrome.tabs.update(currentTabId, { url: `https://www.linkedin.com${newUrl}` }, function (tab) {
          console.log("Tab URL updated:", tab.url);
          console.log(currentTabId);
          chrome.storage.local.set({ currentTabId: currentTabId }, function () {
            console.log("Data saved to Chrome storage:", data);
            chrome.tabs.onUpdated.addListener(linkedinTabListener);
            chrome.tabs.onUpdated.addListener(onTabUpdated);
          });


          // Schedule the next update after 45 seconds
          // setTimeout(function () {
          //   currentIndex++;
          //   updateTabUrl(allJobLinks, currentTabId);
          // }, 45000);
        });
      }

    } else {
      console.log("All URLs updated");
      // You can perform additional actions or send a response if needed
    }
  });
}

function onTabUpdated(tabId, changeInfo, tab) {
  // Check if the tab has finished loading
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { action: "tabUpdated" })
  }
}

// function onComplete(tabId,changeInfo,tab){
//   if (changeInfo.status === 'complete') {
//     chrome.tabs.sendMessage(tabId,{action:"tabComplete"})
//   }
// }

// Add a listener for tab updates



async function fetchData(tabId, fileUrl) {
  console.log(tabId);
  console.log(fileUrl);
  const response = await fetch(fileUrl);
  console.log(response);
  const arrayBuffer = await response.arrayBuffer();
  console.log(arrayBuffer);
  const dataArray = Array.from(new Uint8Array(arrayBuffer));
  console.log(dataArray);
  chrome.tabs.sendMessage(tabId, { 'type': 'uploadDoc', data: dataArray })
}

function openLinkedinTab(data) {
  let url = `https://www.linkedin.com/jobs/search/?`
  var filter = '';
  var keyword = '';
  let location = data.job_location || '';
  // let skills = data.skills;

  // set current skills
  let skills = data.skills;
  if (skills != '') {
    keyword += `&keywords=` + skills;
  }
  if (keyword != '') {
    filter += keyword;
  }

  // let posted = 'data.date_posted';
  let date_posted = '';
  let posted = data.date_posted;
  if (posted) {
    if (posted == 'Past month') {
      date_posted += `&f_TPR=r2592000`;
    } else if (posted == 'Past week') {
      date_posted += `&f_TPR=r604800`;
    } else if (posted == 'Past 24 hours') {
      date_posted += `&f_TPR=r86400`;
    }
  }
  if (date_posted) {
    filter += date_posted;
  }

  // Location
  if (location !== '') {
    filter += `&location=${encodeURIComponent(location)}`;
  }
  //Done experience 
  let experience = data.experience;
  let ExperienceArray = [
    { id: 1, key: 'Internship' },
    { id: 2, key: 'Entry level' },
    { id: 3, key: 'Associate' },
    { id: 4, key: 'Mid-Senior level' },
    { id: 5, key: 'Director' },
    { id: 6, key: 'Executive' }
  ];

  const foundExperience = ExperienceArray.find(item => item.key === experience);
  if (experience && foundExperience) {
    filter += '&f_E=' + foundExperience.id;
  }
  console.log(foundExperience);

  // job type done
  let JobTypeArray = [
    { id: 'F', key: 'Full-time' },
    { id: 'P', key: 'Part-time' },
    { id: 'C', key: 'Contract' },
    { id: 'T', key: 'Temporary' },
    { id: 'I', key: 'Volunteer' },
    { id: '1', key: 'On-Site' },
    { id: '2', key: 'Remote' },
    { id: '3', key: 'Hybrid' },
  ];
  let job_type = data.job_type;
  const foundJobType = JobTypeArray.find(item => item.key === job_type);
  if (foundJobType && job_type) {
    filter += '&f_WT=' + foundJobType.id;
  }

  // done Job Under 10 Applicants
  // let job_application = true;
  // if(job_application){
  //   filter += '&f_EA='+job_application;
  // }

  //easy apply
  filter += '&f_AL=true';

  linkedInUrl = url + filter;
  let isLinkedInTab = false;
  let linkedInTab = null;

  console.log(linkedInUrl, "llllllllllllll");
  chrome.windows.getAll({ populate: true }, function (list) {
    console.log("list----", list[0].tabs)
    list[0].tabs.filter(tabs => {
      console.log("tabs", tabs.url)
      if (tabs.url.includes("linkedin.com")) {
        isLinkedInTab = true;
        linkedInTab = tabs.id;
        return
      }
    })
    if (isLinkedInTab == true) {
      console.log("if---")
      chrome.tabs.update(linkedInTab, { url: linkedInUrl, active: true }, function (tab) {
        console.log("tab updated")
        chrome.storage.local.set({ UpdatedlinkedInTab: tab.id }, function () {
          chrome.tabs.onUpdated.addListener(linkedinTabListenerUpdate);
        });
      });
      // // window.location.href = linkedInUrl;
      // setTimeout(() => {
      //   chrome.storage.local.get(['jobData'], function (result) {
      //     chrome.tabs.sendMessage(linkedInTab, {
      //       type: 'searchJobs',
      //       from: 'background',
      //       jobCount: parseInt(result.jobData.job_count),
      //       resume: resume ? resume : "",
      //       additionalInfo: additionalInfo ? additionalInfo : "",

      //     });
      //   });
      // }, 5000);


    } else {
      console.log("else---")
      chrome.storage.local.get(['jobData'], function (result) {
        chrome.tabs.create(
          {
            url: linkedInUrl,
            active: true,
          },
          function (tabs) {
            linkedinTabId = tabs.id;
            jobCount = parseInt(result.jobData.job_count);
            chrome.tabs.onUpdated.addListener(linkedinTabListener);
          }
        );
      });
    }

  });


};
function linkedinTabListenerUpdate(tabId, changeInfo, tab) {
  console.log("i am comes in linkedinTabListenerUpdate")
  chrome.storage.local.get(['UpdatedlinkedInTab','jobData'], function (result) {
    if (changeInfo.status === 'complete' && tabId === result.UpdatedlinkedInTab) {
      console.log("i am comes in UpdatedlinkedInTab")
      chrome.tabs.sendMessage(result.UpdatedlinkedInTab, {
        type: 'searchJobs',
        from: 'background',
        jobCount: parseInt(result.jobData.job_count),
        resume: resume ? resume : "",
        additionalInfo: additionalInfo ? additionalInfo : "",
      });
      chrome.tabs.onUpdated.removeListener(linkedinTabListenerUpdate);
    }
  })
}

function linkedinTabListener(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tabId === linkedinTabId) {
    chrome.storage.local.get(['jobData'], function (result) {
      chrome.tabs.sendMessage(linkedinTabId, {
        type: 'searchJobs',
        from: 'background',
        jobCount: parseInt(result.jobData.job_count),
        resume: resume ? resume : "",
        additionalInfo: additionalInfo ? additionalInfo : "",

      });
    });
    chrome.tabs.onUpdated.removeListener(linkedinTabListener);
  }
};

