import { CONFIG } from '../../config/constants.js';
import { ErrorHandler, retryOperation } from '../../utils/error-handler.js';

/**
 * LinkedIn Navigation Handler
 * Handles navigation between job pages and search results
 */
export class NavigationHandler {
  constructor() {
    this.currentPage = 1;
    this.jobLinks = [];
    this.currentJobIndex = 0;
    this.init();
  }

  /**
   * Initialize the navigation handler
   */
  init() {
    console.log('Navigation handler initialized');
  }

  /**
   * Navigate to next job
   */
  async navigateToNextJob() {
    try {
      const result = await retryOperation(async () => {
        return await this.performNavigation();
      }, {
        maxRetries: 3,
        delay: 1000,
        onRetry: (error, attempt) => {
          console.log(`Retrying navigation, attempt ${attempt}:`, error.message);
        }
      });

      return result;

    } catch (error) {
      await ErrorHandler.handleError(error, 'navigate-to-next-job');
      throw error;
    }
  }

  /**
   * Perform the actual navigation
   */
  async performNavigation() {
    // Check if we're on a job details page
    if (this.isJobDetailsPage()) {
      return await this.navigateFromJobDetails();
    }
    
    // Check if we're on a search results page
    if (this.isSearchResultsPage()) {
      return await this.navigateFromSearchResults();
    }
    
    throw new Error('Unknown page type for navigation');
  }

  /**
   * Navigate from job details page
   */
  async navigateFromJobDetails() {
    // Try to find and click the "Next" button
    const nextButton = this.findNextButton();
    
    if (nextButton) {
      await this.clickElement(nextButton);
      await this.waitForPageLoad();
      return { success: true, type: 'next-job' };
    }
    
    // If no next button, try to go back to search results
    const backButton = this.findBackButton();
    if (backButton) {
      await this.clickElement(backButton);
      await this.waitForPageLoad();
      return { success: true, type: 'back-to-search' };
    }
    
    throw new Error('No navigation options found');
  }

  /**
   * Navigate from search results page
   */
  async navigateFromSearchResults() {
    // Get job links if not already collected
    if (this.jobLinks.length === 0) {
      this.jobLinks = await this.collectJobLinks();
    }
    
    // Navigate to next job in the list
    if (this.currentJobIndex < this.jobLinks.length) {
      const nextJobUrl = this.jobLinks[this.currentJobIndex];
      window.location.href = nextJobUrl;
      return { success: true, type: 'navigate-to-job' };
    }
    
    // If no more jobs, try to go to next page
    return await this.navigateToNextPage();
  }

  /**
   * Navigate to next page of search results
   */
  async navigateToNextPage() {
    const nextPageButton = this.findNextPageButton();
    
    if (nextPageButton) {
      await this.clickElement(nextPageButton);
      await this.waitForPageLoad();
      this.currentPage++;
      this.currentJobIndex = 0;
      this.jobLinks = []; // Reset job links for new page
      return { success: true, type: 'next-page' };
    }
    
    throw new Error('No more pages available');
  }

  /**
   * Find next button on job details page
   */
  findNextButton() {
    const selectors = [
      '[aria-label="Next job"]',
      '.jobs-s-pagination__next',
      '[data-test-id="next-job"]',
      'button[aria-label*="Next"]',
      'a[aria-label*="Next"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.visible) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Find back button
   */
  findBackButton() {
    const selectors = [
      '[aria-label="Back"]',
      '.jobs-s-pagination__previous',
      '[data-test-id="back"]',
      'button[aria-label*="Back"]',
      'a[aria-label*="Back"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.visible) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Find next page button on search results
   */
  findNextPageButton() {
    const selectors = [
      '[aria-label="Next"]',
      '.jobs-s-pagination__next',
      '[data-test-id="next-page"]',
      'button[aria-label*="Next"]',
      'a[aria-label*="Next"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.visible) {
        return element;
      }
    }
    
    return null;
  }

  /**
   * Collect job links from search results
   */
  async collectJobLinks() {
    const links = [];
    const selectors = [
      'a[href*="/jobs/view/"]',
      '.job-card-container a[href*="/jobs/view/"]',
      '[data-test-id="job-card-link"]'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const href = element.getAttribute('href');
        if (href && href.includes('/jobs/view/')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
          if (!links.includes(fullUrl)) {
            links.push(fullUrl);
          }
        }
      });
    });

    return links;
  }

  /**
   * Click an element
   */
  async clickElement(element) {
    return new Promise((resolve) => {
      element.click();
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }

  /**
   * Check if current page is job details page
   */
  isJobDetailsPage() {
    return window.location.href.includes('/jobs/view/') || 
           window.location.href.includes('/jobs/details/');
  }

  /**
   * Check if current page is search results page
   */
  isSearchResultsPage() {
    return window.location.href.includes('/jobs/search') || 
           window.location.href.includes('/jobs/') && !this.isJobDetailsPage();
  }

  /**
   * Scroll to load more jobs
   */
  async scrollToLoadMore() {
    return new Promise((resolve) => {
      let scrollCount = 0;
      const maxScrolls = 5;
      const scrollHeight = 1000;

      const scroll = () => {
        if (scrollCount >= maxScrolls) {
          resolve();
          return;
        }

        window.scrollBy(0, scrollHeight);
        scrollCount++;

        setTimeout(() => {
          // Check if new content loaded
          const currentHeight = document.body.scrollHeight;
          scroll();
        }, 2000);
      };

      scroll();
    });
  }

  /**
   * Get current page number
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get current job index
   */
  getCurrentJobIndex() {
    return this.currentJobIndex;
  }

  /**
   * Set current job index
   */
  setCurrentJobIndex(index) {
    this.currentJobIndex = index;
  }

  /**
   * Get total job links
   */
  getTotalJobLinks() {
    return this.jobLinks.length;
  }

  /**
   * Reset navigation state
   */
  reset() {
    this.currentPage = 1;
    this.jobLinks = [];
    this.currentJobIndex = 0;
  }
}

// Create global instance
export const navigationHandler = new NavigationHandler(); 