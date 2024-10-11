async function applyToJobs() {
  scrollAndCheck();
  // const element = document.querySelector(".jobs-search-results-list");
  // element.scrollTop = element.scrollHeight;
  const jobCardElements = document.querySelectorAll(
    '[data-view-name="job-card"]'
  );
  // document.querySelectorAll(".visually-hidden")
  for (let i = 0; i < jobCardElements.length; i++) {
    const element = jobCardElements[i];
    element.click();

    // Wait for 5 seconds to allow the modal to open
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Find the apply button and click it
    let applyButton = document.querySelector(".jobs-apply-button");
    if (applyButton) {
      applyButton.click();
    } else {
      console.log("No apply button found for job " + (i + 1));
      continue; // Skip to the next job if no apply button is found
    }

    // Wait for 5 seconds after clicking the apply button
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Now look for the "next" button and click it
    let nextButton = document.querySelector("[data-easy-apply-next-button]");
    if (nextButton) {
      nextButton.click();
      alert("Applied to job " + (i + 1) + " and moved to the next step.");
    } else {
      console.log("No next button found for job " + (i + 1));
    }

    // Wait for another 5 seconds before moving to the next job
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let step2 = document.querySelector("[data-easy-apply-next-button]")
      ? document.querySelector("[data-easy-apply-next-button]")
      : document.querySelector('[aria-label="Review your application"]')
      ? document.querySelector('[aria-label="Review your application"]')
      : "";
    if (step2) {
      step2.click();
      alert("Applied to job " + (i + 1) + " and moved to the next step.");
    } else {
      console.log("No next button found for job " + (i + 1));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let step3 = document.querySelector("[data-easy-apply-next-button]")
      ? document.querySelector("[data-easy-apply-next-button]")
      : document.querySelector('[aria-label="Review your application"]')
      ? document.querySelector('[aria-label="Review your application"]')
      : "";
    if (step3) {
      step3.click();
      alert("Applied to job " + (i + 1) + " and moved to the next step.");
    } else {
      console.log("No next button found for job " + (i + 1));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function scrollAndCheck() {
  const container = document.querySelector(".jobs-search-results-list");

  // Scroll by 20%
  container.scrollTop += container.scrollHeight * 0.2;

  // Check if the specific element is found
  // const targetElement = document
  //   .querySelector(".artdeco-list")
  //   ?.children[
  //     document.querySelector(".artdeco-list").children.length - 1
  //   ]?.querySelector(".artdeco-entity-lockup")
  //   ?.querySelector(".artdeco-entity-lockup__title");
  const targetElement = document
    .querySelectorAll('[data-view-name="job-card"]')[24]
    ?.querySelectorAll(".visually-hidden")[0];

  if (targetElement) {
    console.log("Element found. Stopping scroll.");
  } else {
    console.log("Element not found. Scrolling again...");
    // Continue scrolling after a delay
    setTimeout(scrollAndCheck, 1000); // Adjust the delay as needed
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "executeFunction") {
    applyToJobs();
  }
});
