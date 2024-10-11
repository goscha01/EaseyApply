let cancel = false;

function startApplying() { 
    console.log('startApplying()'); 
    cancel = false;
    // Ensure buttons are visible
    document.getElementById('startButton').style.display = 'block';
    document.getElementById('stopButton').style.display = 'block';
    scrollAndCheck();
  }

function stopApplying() {
  console.log('stopApplying()'); 
  cancel = true;
  alert("Application stopped!");
}

async function applyToJobs() {
  console.log('applyToJobs() start'); 
  const jobCardElements = document.querySelectorAll('[data-view-name="job-card"]');
  console.log('jobCardElements ', jobCardElements);

  for (let i = 0; i < jobCardElements.length; i++) {
    if (cancel) {
      console.log('applyToJobs execution stopped.');
      break;
    }
    const element = jobCardElements[i];
    console.log(`element${i}`, element); 
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
        showMissingFieldsForm();
        return; // Stop further execution until the form is filled
      }

      await handleButtonClick(step, i);
      await delay(1000); // Wait after each button click
    }
  }
  console.log('applyToJobs() ends'); 
}

function scrollAndCheck() {
  if (cancel) {
    console.log('scrollAndCheck execution stopped.');
    return;
  }
  console.log('scrollAndCheck()'); 
  const container = document.querySelector(".jobs-search-results-list");
  container.scrollTop += container.scrollHeight * 0.2;

  const targetElement = document
    .querySelectorAll('[data-view-name="job-card"]')[24]
    ?.querySelectorAll(".visually-hidden")[0];
  console.log("targetElement: ", targetElement);

  if (targetElement) {
    console.log("Element found. Stopping scroll.");
    applyToJobs();
  } else {
    moreDataRequest();
  }
}

async function handleButtonClick(selector, i) {
  console.log('handleButtonClick() for selector:', selector);
  
  let element;
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

function moreDataRequest() {
  console.log('moreDataRequest()'); 
  alertTaggle('No required data: OK to continue, CANCEL to stop');
}

function alertTaggle(text) {
  console.log('alertTaggle()'); 
  let confirmation = confirm(text);
  console.log('confirmation ', confirmation);
  if (confirmation === false) {
    stopApplying();
    console.log('CANCEL alert stop ', cancel);
  } else {
    console.log('CANCEL alert continue', cancel);
    setTimeout(scrollAndCheck, 1000);
  }
}

function areAllInputsFilled() {
    console.log('areAllInputsFilled ')
  const inputs = document.querySelectorAll('input, textarea, select');
  for (const input of inputs) {
    if (!input.value.trim()) {

        console.log('INPUT ', input)
      return false; // Return false if any input is empty
    }
  }
  return true; // Return true if all inputs are filled
}

// New function to show a form for missing fields
function showMissingFieldsForm() {
    const missingFields = Array.from(document.querySelectorAll('input, textarea, select')).filter(input => !input.value.trim());
    
    console.log('Missing fields:', missingFields); // Debugging line
  
    if (missingFields.length > 0) {
      const formHtml = `
        <div id="missingFieldsModal">
          <h3>Please fill out the following fields:</h3>
          ${missingFields.map(field => `
            <div>
              <label>${field.placeholder || 'Field'}:</label>
              <input type="text" value="${field.value}" data-field-name="${field.name}" />
            </div>
          `).join('')}
          <button id="submitMissingFields">Submit</button>
          <button id="cancelMissingFields">Cancel</button>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', formHtml);
      
      // Add event listeners for buttons
      document.getElementById('submitMissingFields').onclick = () => {
        // Logic for submitting the form
      };
  
      document.getElementById('cancelMissingFields').onclick = () => {
        // Logic for canceling the form
      };
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "executeFunction") {
        startApplying();
    } else if (request.action === "stopFunction") {
        stopApplying();
    } else {
        alert('Error!!');
    }
});
