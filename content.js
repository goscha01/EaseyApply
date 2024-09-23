let cancel = false


function startApplying() { 
  console.log('startetApplying()') 
  cancel = false
  scrollAndCheck();
}

function stopApplying() {
  console.log('stopApplying()') 
  cancel = true
  alert("application stopped!")
}

async function applyToJobs() {
  console.log('applyToJobs() start') 
  // const element = document.querySelector(".jobs-search-results-list");
  // element.scrollTop = element.scrollHeight;
  const jobCardElements = document.querySelectorAll(
    '[data-view-name="job-card"]'
  );
  console.log('jobCardElements ', jobCardElements)


  for (let i = 0; i < jobCardElements.length; i++) {
    if (cancel) {
      console.log('applyToJobs execution stopped.');
      break;
    }
    const element = jobCardElements[i];
    console.log(`element${i}`, element) 
    element.click();

    await delay(1000); // Wait after clicking apply button

       const steps = [
        ".jobs-apply-button",
        "[data-easy-apply-next-button]",
        '[aria-label="Review your application"]',
        '[aria-label="Submit application"]'
      ];

      for (let step of steps) {
        if (cancel) {
          console.log('applyToJobs execution stopped during steps.');
          break; // Exit the loop if cancelled
        }

        if (!areAllInputsFilled()) {
          alert("Please fill out all required fields before continuing.");
 
        }
  
        await handleButtonClick(step, i, cancel);
        await delay(1000); // Wait after each button click
      }
       

    console.log('applyToJobs() ends') 

  }
 
}

function scrollAndCheck() {
  if (cancel) {
    console.log('scrollAndCheck execution stopped.');
    return;
  }
  console.log('scrollAndCheck()') 
  const container = document.querySelector(".jobs-search-results-list");

  // Scroll by 20%
  container.scrollTop += container.scrollHeight * 0.2;

  const targetElement = document
    .querySelectorAll('[data-view-name="job-card"]')[24]
    ?.querySelectorAll(".visually-hidden")[0];
  console.log("targetElement: ", targetElement);

  if (targetElement) {
    console.log("Element found. Stopping scroll.");
    applyToJobs()
  } else {
    moreDataRequiest ()
  }
}


async function handleButtonClick(selector, i) {
  console.log('handleButtonClick() for selector:', selector);
  
  let element;
  // Attempt to find the element and retry if it's not found immediately
  for (let attempt = 0; attempt < 3; attempt++) {
    element = document.querySelector(selector);
    if (element) break; // Exit if the element is found
    console.log(`Element not found, retrying... (${attempt + 1})`);
    await delay(500); // Wait before retrying
  }

  if (element) {
    alertTaggle("AppliedButton " + (i + 1) + " clicked");
    if (!cancel) {
      element.click();
    }
  } else {
    console.log("No button found for job " + (i + 1));
    moreDataRequest();
  }
}





function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

 
 

function moreDataRequiest () {
  console.log('moreDataRequiest()') 
   alertTaggle ('No required data: OK for continue, CANCEL for  stop')

}

function alertTaggle (text) {
  console.log('alertTaggle()') 
  let conformation = confirm(text)
  console.log('conformation ', conformation)
  if(conformation == false) {
      stopApplying()
      console.log('CANCEL alert stop ', cancel)
  } else {
    console.log('CANCEL alkert continue', cancel)
    setTimeout(scrollAndCheck, 1000)
  }
}

function alertTaggle(text) {
  console.log('alertTaggle()');
  let confirmation = confirm(text);
  console.log('confirmation ', confirmation);
  if (confirmation === false) {
    stopApplying();
    console.log('CANCEL alert stop1 ', cancel);
  } else {
    console.log('CANCEL alert continue', cancel);
    setTimeout(scrollAndCheck, 1000);
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "executeFunction") {
    startApplying();
  } else if (request.action === "stopFunction") {
    stopApplying()
   } else {
    alert('Error!!')
  }
});


function areAllInputsFilled() {
  const inputs = document.querySelectorAll('input, textarea, select'); // Select all input, textarea, and select elements
  for (const input of inputs) {
    if (!input.value.trim()) { // Check if the input is empty or contains only whitespace
      return false; // Return false if any input is empty
    }
  }
  return true; // Return true if all inputs are filled
}