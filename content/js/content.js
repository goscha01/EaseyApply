console.log('here 1');
var job_count = 0;
jQuery.fn.extend({
    mclick: function () {
        var click_event = document.createEvent("MouseEvents");
        click_event.initMouseEvent(
            "click",
            true,
            true,
            window,
            0,
            0,
            0,
            0,
            0,
            false,
            false,
            false,
            false,
            0,
            null
        );
        return $(this).each(function () {
            $(this)[0].dispatchEvent(click_event);
        });
    },
    'vchange': function () {
        var change_event = document.createEvent('HTMLEvents')
        change_event.initEvent('change', false, true)
        return $(this).each(function () {
            $(this)[0].dispatchEvent(change_event)
        })
    },
});
var data = {};
var job_links = [];
var user_id = '';
var counter = 0;
var resume;
var additionalInfo = [];
var phone = '009099008';
var cv = "121.txt";
var state;
var pincode;
var address;
var clickButtonInterval;
var city = '';
var currentSalary = 1;
var expectedSalary = 1;
var coverLetter = '';
var noticePeriod = 15;
var workExperience = '0';
var index = 0;

var atoModel = `<div id="job-auto" class="modal">
                <!-- Modal content -->
                <div class="modal-content">
                  <p>Job Automation</p>
                  <progress id="progressBar"  value="1" max="100"> </progress>
                </div>
              </div>`;






// additionalInfo = message.additionalInfo;
(function ($) {
    const Module = {
        settings: {},
        init: function () {
            const $this = Module;
            $this.bindEvents();
            $this.initial();
            //$this.filtersJobs(5);
            //$this.autoFillQuestions(additionalInfo);
            // Listen for message to reload current page
            chrome.runtime.onMessage.addListener((message, sender, send_response) => {
                // save apply Linkedin data
                if (message.type == 'searchJobs' && message.from == 'background') {
                    $this.createStopButton();
                    resume = message.resume;
                    additionalInfo = message.additionalInfo;
                    phone = additionalInfo.phone;
                    cv = `${config.cvUrl}/${resume.file_path}`;
                    state = additionalInfo.state;
                    pincode = "135001";
                    address = `${state} ${pincode} `;
                    city = additionalInfo.city;
                    additionalInfo = message.additionalInfo;
                    currentSalary = additionalInfo.current_salary;
                    expectedSalary = additionalInfo.expected_salary;
                    noticePeriod = additionalInfo.notice_period;
                    workExperience = additionalInfo.experience;
                    coverLetter = "This is cover letter";
                    // expectedSalary = additionalInfo.expected_salary;
                    workExperience = additionalInfo.work_knowledge;
                    noticePeriod = 30;
                    coverLetter = null;
                    job_count = message.jobCount;
                    console.log("job_count----", job_count)

                    setTimeout(() => {
                        $this.filtersJobs(job_count);

                    }, 4000);

                } else if (message.type == 'uploadDoc') {
                    console.log(message);
                    var dataArray = message.data;
                    console.log(dataArray);
                    console.log(cv);
                    $this.uploadResume(dataArray, cv)
                } else if (message.action == "tabUpdated") {
                    console.log("updated");
                    this.autoFillQuestions(message.additionalInfo);
                } else if (message.action == "processComplete") {
                    console.log("status complete")
                    if ($('.artdeco-modal.artdeco-modal--layer-default')) {
                        let dismissButton = $('.artdeco-modal.artdeco-modal--layer-default').find('button[aria-label="Dismiss"]');

                        if ($(dismissButton).length > 0) {
                            $(dismissButton).click();
                            setTimeout(() => {
                                if ($("#scanningModal").length > 0) {
                                    $("#scanningModal").css("display", "none");
                                }
                                $("#stopButton").hide();
                                this.showProcessComplete();
                            }, 2000);
                        } else {
                            console.log("Dismiss button not found!");
                            $("#stopButton").hide()
                            this.showProcessComplete();
                        }

                    }
                    else {
                        $("#stopButton").hide()
                        this.showProcessComplete();
                    }


                }
            })
        },
        autoFillQuestions: function (additionalInfo) {
            setTimeout(() => {
                const applyButtonInterval = setInterval(() => {
                    const applyButtons = $('button:not([disabled]).jobs-apply-button.artdeco-button.artdeco-button');

                    // Check if there are apply buttons available
                    if (applyButtons.length > 0) {
                        const applyButtonToClick = applyButtons.eq(0);
                        applyButtonToClick.click();
                        applyButtonToClick.click();
                        applyButtonToClick.click();
                        clearInterval(applyButtonInterval);
                        const modelInterval = setInterval(() => {
                            this.reviewButton();
                            this.clickNextButton();
                            this.uploadSingleFileToInput(cv);
                            clearInterval(modelInterval);
                            let checkQueField = setInterval(() => {
                                if ($('.jobs-easy-apply-content .mercado-match').length <= 0) {
                                    console.log("form has filled");
                                    if ($('[aria-label="Submit application"]').length > 0) {
                                        setTimeout(() => {
                                            this.submitModelform();
                                        }, 5000);
                                    } else {
                                        setTimeout(() => {
                                            this.reviewButton();
                                        }, 5000);
                                    }
                                    if ($('#post-apply-modal').length > 0 || $('[data-view-name="job-post-apply-timeline"]').length > 0) {
                                        clearInterval(checkQueField)
                                        setTimeout(() => {
                                            console.log("send massage to background")
                                            chrome.runtime.sendMessage({
                                                type: 'goingToNextJob',

                                            });
                                        }, 2000);


                                    }

                                }
                            }, 2000);

                            // NEW CODE START HERE FROM SOBI
                            const MODEL_MAIN = 'div[data-test-modal-id="easy-apply-modal"]'; // MAIN MODEL DIV SELECTOR

                            const MODEL_QUESTIONS_LI = '.jobs-easy-apply-form-section__grouping'; // INNER LI OF QUESTIONS
                            // setTimeout(() => {
                            //     if ($(MODEL_MAIN).find(MODEL_QUESTIONS_LI).length > 0) {
                            //         $(MODEL_MAIN).find(MODEL_QUESTIONS_LI).each(function (index, i) {
                            //             setTimeout(() => {
                            //                 //console.log($(this).find('label:contains("experience")').length);
                            //                 // FOR NUMERIC VALUES
                            //                 let numeric_question_text = $(this).find('label[for*="-numeric"]').text();
                            //                 console.log(numeric_question_text);
                            //                 const $inputWorkExperienceElement = $(this).find('label[for*="-numeric"]').next('input[type="text"]');
                            //                 if ($inputWorkExperienceElement.length > 0) {
                            //                     chrome.runtime.sendMessage({ type: "getAnswersFromchatgpt", question: numeric_question_text }, function (response) {
                            //                         console.log(response.answers.experience);
                            //                         let answer_value = 0;
                            //                         if (numeric_question_text.includes("experience work")) {

                            //                         }

                            //                         if (numeric_question_text.includes("expected salary")) {
                            //                             answer_value = response.answers.expected_salary;
                            //                         }

                            //                         if (/experience.*work|work.*experience/.test(numeric_question_text)) {
                            //                             answer_value = response.answers.experience;
                            //                         }

                            //                         if (/current.*salary|salary.*current/.test(numeric_question_text)) {
                            //                             answer_value = response.answers.current_salary;
                            //                         }

                            //                         if (/expected.*salary|salary.*expected/.test(numeric_question_text)) {
                            //                             answer_value = response.answers.expected_salary;
                            //                         }

                            //                         if (/preferred.*salary|preferred.*expected/.test(numeric_question_text)) {
                            //                             answer_value = response.answers.expected_salary;
                            //                         }
                            //                         console.log(answer_value, "AAAAAAAAA");
                            //                         navigator.clipboard.writeText(answer_value).then(() => {
                            //                             $inputWorkExperienceElement.focus();
                            //                             $inputWorkExperienceElement.select();
                            //                             document.execCommand('paste');
                            //                         });
                            //                         $(".artdeco-modal .artdeco-button__text").click();
                            //                     });

                            //                 } else if ($(this).find('select[id]').length > 0) {
                            //                     let select = $(this).find('select[id]');
                            //                     select.each(function (index) {
                            //                         setTimeout(() => {
                            //                             select.prop("selectedIndex", 1);
                            //                             select.trigger("change");
                            //                             select.vchange();
                            //                         }, 1000)
                            //                     });
                            //                 } else if ($(this).find('label[data-test-text-selectable-option__label]').length > 0) {
                            //                     const radiobutton = $(this).find('label[data-test-text-selectable-option__label="No"]');
                            //                     radiobutton.mclick();
                            //                 } else {
                            //                     console.log("nothings");
                            //                 }
                            //             }, 1000);
                            //         })
                            //     }
                            //     setTimeout(() => {
                            //         this.submitModelform();
                            //     }, 7000);
                            // }, 8000)



                            // this.appendPhoneVal();
                            // this.appendAddressVal();
                            // this.appendCityval();
                            //this.appendPostalCodeVal();
                            //this.currentSalaryVal();
                            // this.expectedSalaryVal();
                            //this.workingKnowledge();
                            //this.jobLocationComfortable();
                            //this.configuringManaging();
                            //this.internPosition();
                            // this.applicationSent();
                            // this.noticePeriodVal();

                            // setTimeout(() => {
                            //     this.workExperience();
                            // }, 2000);


                            // setTimeout(() => {
                            //     this.radiobuttonFilled();
                            // }, 2500);

                            // setTimeout(() => {
                            //     this.selectboxFilled();
                            // }, 3500);

                            // setTimeout(() => {
                            //   this.sameSalary();
                            // }, 4000);

                            // setTimeout(() => {
                            //     this.hybridsetting();
                            // }, 5000);

                            // setTimeout(() => {
                            //     this.submitModelform();
                            // }, 7000);

                            // setTimeout(() => {
                            //   this.notFoundInDomVal();
                            // }, 8000);                              


                            // setTimeout(() => {
                            //     this.reviewButton();
                            //     this.clickNextButton();
                            // }, 12000);

                        }, 3000)
                    }

                }, 1000); // Adjust the interval as needed
            }, 2000); // Adjust the delay before starting the interval as needed 
        },

        bindEvents: function () {

            var progressBar = document.getElementById("progressBar");

            $('body').append(atoModel);
            $('#search').on('keyup', function () { });

            $('.toaster-close').on('click', function () {
                $('#toaster').hide();
            });

            $('#linkdin-apply').click(function () {
                $('#apply_modal input').val('');
            });
            // click on Save button            
            $('#apply_modal button.btn-primary').on('click', function () {
                console.log("jhhhhh")
                $('#apply_modal button.btn-primary').attr('disabled', true).text('Processing');
                var skills = $('#apply_modal input[name="skills"]').val();
                var job_location = $('#apply_modal input[name="job_location"]').val();
                var job_count = $('#apply_modal [name="job_count"]').val();
                var experience = $('#apply_modal [name="experience"]').val();
                var job_type = $('#apply_modal [name="job_type"]').val();
                console.log(job_type);
                var date_posted = $('#apply_modal [name="date_posted"]').val();
                data = {
                    skills: skills,
                    job_location: job_location,
                    job_count: job_count,
                    experience: experience,
                    job_type: job_type,
                    date_posted: date_posted,
                };
                console.log(data);

                $('#apply_modal button.btn-primary').attr('disabled', false).text('Submit');
                chrome.runtime.sendMessage({
                    type: 'applyLinkedin',
                    data: data,
                });
            });
        },

        initial: function () { },

        filtersJobs: function (job_count) {
            console.log('job_count - ', job_count);
            var jobinterval = setInterval(() => {
                var jobResultsContainer = $('ul.scaffold-layout__list-container li.scaffold-layout__list-item');
                if (jobResultsContainer.length > 0) {
                    clearInterval(jobinterval);
                    this.scrollSearch();
                    this.processJobItems(0, job_count); // Start processing the first job item
                }
            }, 1000);
        },

        scrollSearch() {
            const jobResultsContainer = $('ul.scaffold-layout__list-container');
            if (jobResultsContainer.length) {
                $('.jobs-search-results-list').animate({
                    scrollTop: jobResultsContainer.height(),
                },
                    4000
                );
            }
        },

        profileScanning: async function () {
            console.log(index);
            console.log(job_count, "job count for profileScaning ");
            // Create and append the modal to the body

            var modal = $('<div id="scanningModal" style="display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border: 1px solid #ccc; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); text-align: center; z-index: 9999;">Scanning the LinkedIn profiles...</div>');
            $('#scanningModal').append(modal);
            $('body').append(modal);
            var pageNoIndex = 0;
            var allJobLinks = [];

            var linksCollectionInterval = setInterval(() => {
                this.scrollSearch();
                var All_Jobs = $('ul.scaffold-layout__list-container li.scaffold-layout__list-item:not(:has(span.tvm__text.tvm__text--neutral)');
                console.log(All_Jobs, "all_job");

                setTimeout(() => {
                    if ($('.job-card-container__apply-method').find('svg').length > 0) {

                        // var filteredLinks = All_Jobs.find('a').filter(function () {
                        //     // Filter only <a> tags with href attribute
                        //     if($(this).find('.job-card-container__apply-method').find('svg').length > 0){
                        //         return $(this).attr('href');
                        //     }
                        // });
                        var filteredLinks = All_Jobs.each(function() {
                            if ($(this).find('li.job-card-container__apply-method svg').length > 0) {
                                console.log($(this).find('a'));
                                return $(this).find('a').attr('href');
                            }
                        });
                        console.log("filteredLinks",filteredLinks)
                        // Extract href text from the filtered links
                        var job_links = filteredLinks.map(function () {
                            if ($(this).find('li.job-card-container__apply-method svg').length > 0) {
                                console.log($(this).find('a'));
                                return $(this).find('a').attr('href');
                            }
                        }).get();
                        


                        console.log(job_links, "job links");
                    }
                    // Add the current page's job links to the overall list
                    allJobLinks = allJobLinks.concat(job_links);
                    console.log("alljoblinks",allJobLinks);
                    // return false;
                    // chrome.tabs
                    if (allJobLinks.length < job_count) {
                        console.log("i am come in if condition")
                        pageNoIndex++;

                        console.log(pageNoIndex);
                        var specificPageNos = $('ul.artdeco-pagination__pages li[data-test-pagination-page-btn]');
                        var specific_buttons = specificPageNos.find('button');
                        var pagebutton = specific_buttons[pageNoIndex];

                        // Check if the button exists before clicking
                        if (pagebutton) {
                            setTimeout(() => {
                                pagebutton.click();
                            }, 4000);
                            console.log(specific_buttons[pageNoIndex]);
                        } else {
                            // No more pages, clear the interval
                            clearInterval(linksCollectionInterval);
                        }

                    } else {
                        console.log("i am come in else conditon")
                        // Reached the desired job_count, clear the interval
                        clearInterval(linksCollectionInterval);
                        setTimeout(() => {
                            $('#scanningModal').hide();
                            chrome.runtime.sendMessage({ type: "updateTab", linksArray: allJobLinks }, function (response) {
                                console.log("Message sent from content script to background script:", response);
                            });
                        }, 4000);

                    }
                }, 8000);
            }, 15000);
        },




        processJobItems: function (index, job_count) {


            this.profileScanning();

        },

        // Call the function with the initial index and job count

        // Check delay
        delay: function (ms) {
            return new Promise((resolve) => setTimeout(resolve, ms));
        },

        reviewButton: function () {
            var reviewInterval = setInterval(() => {
                $('button[aria-label="Review your application"]').click();
            });
        },

        clickNextButton() {
            console.log("click Next Button called");
            clickButtonInterval = setInterval(() => {
                $('button[aria-label="Continue to next step"]').click();
            }, 3000);
        },



        appendPhoneVal: async function () {
            console.log('appendPhoneVal');
            var phoneInterval = setInterval(async () => {
                const labelContainingPhone = $('label:contains("Phone")');
                console.log(labelContainingPhone);
                if (labelContainingPhone.length > 0) {
                    // Find the next input element after the label
                    const inputPhoneElement = labelContainingPhone.next('input[type="text"]');
                    console.log(inputPhoneElement.length);
                    if (inputPhoneElement.length > 0) {
                        clearInterval(phoneInterval);
                        inputPhoneElement.val(phone);
                    }
                    await this.delay(200);
                }
            }, 2000);
        },

        QuestionsCollector() {
            console.log("QuestionsCollector is called");

            // Create an array to store the texts
            var textsArray = [];

            var codeInterval = setInterval(async () => {
                var questionElements = $('.jobs-easy-apply-form-section__grouping');

                // Check if there are more questions to process
                if (questionElements.length > 0) {

                    questionElements.each(function () {
                        var label = $(this).find('label').text().trim();
                        var spanTitle = $(this).find('span[data-test-form-builder-radio-button-form-component__title]').text().trim();

                        if (label && !textsArray.includes(label)) {
                            textsArray.push(label);
                        }

                        if (spanTitle && !textsArray.includes(spanTitle)) {
                            textsArray.push(spanTitle);
                        }
                    });

                    // Remove empty and duplicate items from the array
                    textsArray = textsArray.filter((text, index, self) => {
                        return text !== '' && index === self.indexOf(text);
                    });

                    textsArray.forEach(element => {
                        setTimeout(() => {
                            chrome.runtime.sendMessage({ 'type': 'callGPT', 'qesArray': [element] });
                            clearInterval(codeInterval);
                        }, 5000);
                    });

                    // Clear the textsArray after processing
                    textsArray = [];
                } else {
                    // If there are no more questions, clear the interval

                    console.log('All questions processed.');
                }

                // Log the final array
                console.log(textsArray);

            }, 2000);
        },


        appendPostalCodeVal() {
            console.log('appendPostalCodeVal');
            console.log(pincode);
            var codeInterval = setInterval(async () => {
                const labelContainingZip = $('label:contains("Postal Code") , label:contains("postal") , label:contains("Postal")');
                console.log(labelContainingZip);
                if (labelContainingZip.length > 0) {
                    // Find the next input element after the label
                    const inputZipElement = labelContainingZip.next('input[type="text"]');
                    console.log(inputZipElement.length);
                    if (inputZipElement.length > 0) {
                        clearInterval(codeInterval);
                        const inputZipElements = inputZipElement.first();
                        navigator.clipboard.writeText(pincode).then(() => {
                            console.log(" Text Copied!!!!");
                            inputZipElements.focus();
                            document.execCommand("paste", null, null);
                        });
                        setTimeout(() => {
                            console.log(inputZipElements.val());
                        }, 3000);
                    }
                }
            }, 2000);
        },

        appendCityval() {
            // console.log('appendCityval');
            // console.log(city);
            var cityInterval = setInterval(async () => {
                const labelContainingCity = $('label:contains("City") ,  label:contains("City*")');
                console.log(labelContainingCity);
                if (labelContainingCity.length > 0) {
                    const inputCityElement = labelContainingCity.next('input[type="text"]');
                    console.log(inputCityElement.length);
                    if (inputCityElement.length > 0) {
                        clearInterval(cityInterval);
                        const inputCityElements = inputCityElement.first();
                        console.log(inputCityElements);
                        navigator.clipboard.writeText(city).then(() => {
                            console.log(" Text Copied!!!!");
                            inputCityElements.focus();
                            document.execCommand("paste", null, null);
                        });
                        setTimeout(() => {
                            console.log(inputCityElements.val());
                        }, 3000);
                    }
                }
            }, 2000);
        },

        appendAddressVal() {
            console.log('appendAddressVal');
            var addressInterval = setInterval(async () => {
                const labelContainingAddress = $('label:contains("address line 1")');
                console.log(labelContainingAddress);
                if (labelContainingAddress.length > 0) {
                    const inputAddressElement = labelContainingAddress.next('input[type="text"]');
                    console.log(inputAddressElement);
                    if (inputAddressElement.length > 0) {
                        clearInterval(addressInterval);
                        const inputAddressElements = inputAddressElement.first();
                        console.log(inputAddressElement);
                        navigator.clipboard.writeText(currentSalary).then(() => {
                            console.log(" Text Copied!!!!");
                            inputAddressElements.focus();
                            document.execCommand("paste", null, null);
                        });
                        setTimeout(() => {
                            console.log(inputAddressElements.val());
                        }, 3000);
                    }
                }
            }, 2000);
        },

        currentSalaryVal() {
            var currentInterval = setInterval(async () => {
                const labelContainingCurrentSalary = $('label:contains("current salary"), label:contains("current CTC"), label:contains("current annual CTC"),label:contains("current") , label:contains("Current")');
                if (labelContainingCurrentSalary.length > 0) {
                    const inputCurrentSalaryElements = labelContainingCurrentSalary.next('input[type="text"]');
                    console.log($(inputCurrentSalaryElements));
                    if (inputCurrentSalaryElements.length > 0) {
                        clearInterval(currentInterval);
                        const firstInputCurrentSalaryElement = inputCurrentSalaryElements.first();
                        navigator.clipboard.writeText(currentSalary).then(() => {
                            console.log(" Text Copied!!!!");
                            firstInputCurrentSalaryElement.focus();
                            document.execCommand("paste", null, null);
                        });
                        setTimeout(() => {
                            console.log(firstInputCurrentSalaryElement.val());
                        }, 3000);
                    }
                }
            }, 2000);
        },

        expectedSalaryVal() {
            console.log('expected salary');
            var expectedInterval = setInterval(async () => {
                const labelContainingExpectedSalary = $('label:contains("expected salary"),label:contains("expected") , label:contains("Expected")');
                console.log(labelContainingExpectedSalary);
                if (labelContainingExpectedSalary.length > 0) {
                    const inputExpectedSalaryElement = labelContainingExpectedSalary.next('input[type="text"]');
                    console.log($(inputExpectedSalaryElement));
                    if (inputExpectedSalaryElement.length > 0) {
                        clearInterval(expectedInterval);
                        const firstInputExpectedSalaryElement = inputExpectedSalaryElement.first();
                        navigator.clipboard.writeText(expectedSalary).then(() => {
                            console.log(" Text Copied!!!!");
                            firstInputExpectedSalaryElement.focus();
                            document.execCommand("paste", null, null);
                        });

                    }
                }
            }, 2000);
        },

        noticePeriodVal() {
            $('notice period');
            var noticePeriodInterval = setInterval(async () => {
                const labelContainingNoticePeriod = $('label:contains("notice period") , label:contains("join") , label:contains("Notice") , label:contains("notice")');
                console.log(labelContainingNoticePeriod);
                if (labelContainingNoticePeriod.length > 0) {
                    const inputNoticePeriodElement = labelContainingNoticePeriod.next('input[type="text"]');
                    if (inputNoticePeriodElement.length > 0) {
                        clearInterval(noticePeriodInterval);
                        const firstinputNoticePeriodElement = inputNoticePeriodElement.first();
                        navigator.clipboard.writeText(noticePeriod).then(() => {
                            console.log(" Text Copied!!!!");
                            firstinputNoticePeriodElement.focus();
                            document.execCommand("paste", null, null);
                        });
                    }
                }
            }, 2000);
        },
        clickOnRadioButton() {
            // $('notice period');
            var numericInterval = setInterval(async () => {
                const yesradiobtn = $('fieldset[data-test-form-builder-radio-button-form-component="true"]');
                const selectbtn12 = $('select[id]');
                console.log('clickOnRadioButton');
                console.log(yesradiobtn);
                const inputNoticePeriodElement = selectbtn12.addClass('radio-yesno');
                if (yesradiobtn.length > 0) {
                    const inputNoticePeriodElement = yesradiobtn.addClass('radio-yesno');
                    if (inputNoticePeriodElement.length > 0) {
                        clearInterval(noticePeriodInterval);
                        const firstinputNoticePeriodElement = inputNoticePeriodElement.first();
                        navigator.clipboard.writeText("0").then(() => {
                            console.log(" Text Copied!!!!");
                            firstinputNoticePeriodElement.focus();
                            document.execCommand("paste", null, null);
                        });
                    }
                }
            }, 2000);
        },

        notFoundInDomVal() {
            var notFoundInDomValInterval = setInterval(async () => {
                const notFoundInDomElements = $('.jobs-easy-apply-form-section__grouping');
                setTimeout(() => {
                    notFoundInDomElements.each(async function () {
                        const notFoundInDom = $(this);

                        // Find input elements of type "text" within the current notFoundInDom element
                        const inputnotFoundInDom = notFoundInDom.find('input[type="text"]');
                        if (inputnotFoundInDom.length > 0) {
                            clearInterval(notFoundInDomValInterval);
                            // Loop through the input elements within this notFoundInDom element
                            inputnotFoundInDom.each(function () {
                                const inputValue = $(this).val();
                                setTimeout(() => {
                                    if (inputValue === '') {
                                        // Perform some action for empty input fields
                                        navigator.clipboard.writeText(0).then(() => {
                                            inputnotFoundInDom.focus();
                                            document.execCommand("paste", null, null);
                                        });
                                    }
                                }, 3000);
                            });
                        }
                    });
                }, 3000);

            }, 1000);
        },

        selectboxFilled() {
            var setInterval1 = setInterval(async () => {
                const select = $('div[data-test-modal-id="easy-apply-modal"]').find('select[id]');
                console.log(select.length);
                if (select.length > 0) {
                    select.each(function (index) {
                        setTimeout(() => {
                            select.prop("selectedIndex", 1);
                            select.trigger("change");
                            select.vchange();
                        }, 1000)
                        clearInterval(setInterval1);
                    });
                }
            }, 2000);
        },

        radiobuttonFilled() {
            var setInterval2 = setInterval(async () => {
                const radiobutton = $('label[data-test-text-selectable-option__label="No"]');
                //console.log(radiobutton);
                if (radiobutton.length > 0 && $('label[data-test-text-selectable-option__label=""]').length > 0) {
                    radiobutton.mclick();
                }
            }, 2000);
        },

        workExperience() {
            var experienceInterval = setInterval(async () => {
                const labels = $('label:contains("work experience"), label:contains("experience")');
                if (labels.length > 0) {
                    const inputWorkExperienceElements = labels.nextAll('input[type="text"]');
                    // Assuming workExperience contains the data you want to copy to the clipboard
                    const workExperienceData = "0";
                    if (inputWorkExperienceElements.length > 0) {
                        navigator.clipboard.writeText(workExperienceData).then(() => {
                            const inputElementsArray = inputWorkExperienceElements.toArray();
                            inputElementsArray.forEach(function (inputWorkExperienceElement, i) {
                                const $inputWorkExperienceElement = $(inputWorkExperienceElement);
                                let input_val = $inputWorkExperienceElement.val();
                                if (input_val != "undefined" && input_val == '') {
                                    $inputWorkExperienceElement.focus();
                                    setTimeout(() => {
                                        document.execCommand('paste');
                                    }, 1000)
                                }
                            });
                        });
                    }
                }
            }, 2000);
        },

        workingKnowledge() {
            console.log('workingKnowledge');
            var experienceInterval = setInterval(async () => {
                const labelContainsWorkingKnowledge = $('label:contains("working knowledge")');
                console.log(labelContainsWorkingKnowledge);
                if (labelContainsWorkingKnowledge.length > 0) {
                    const selectWorkingKnowledge = labelContainsWorkingKnowledge.next('select');
                    console.log(selectWorkingKnowledge);
                    if (selectWorkingKnowledge.length > 0) {
                        clearInterval(experienceInterval);

                        await this.delay(200);
                        setTimeout(() => {
                            selectWorkingKnowledge.find('option[value="Yes"]').prop('selected', true);
                        }, 4000);
                    }
                }
            }, 2000);
        },

        hybridsetting() {
            var experienceInterval = setInterval(async () => {
                const targetDiv = $('div.jobs-easy-apply-form-section__grouping:has(span:first:contains("hybrid"))');
                console.log(targetDiv);
                clearInterval(experienceInterval);

            }, 2000);
        },

        applicationSent() {
            var experienceInterval = setInterval(async () => {
                const targetDiv = $('h3.jpac-modal-header:contains("application was sent")');
                if (targetDiv.length > 0) {
                    clearInterval(experienceInterval);
                    var close_icon = $('[data-test-modal-close-btn]');
                    if (close_icon.length > 0) {
                        close_icon.mclick();
                        console.log("close button clicked");
                    }
                }


            }, 2000);
        },

        sameSalary() {
            console.log('Same Salary range');
            var experienceInterval = setInterval(async () => {
                const labelContainSameSalary = $('label:contains("same salary range")');
                if (labelContainSameSalary.length > 0) {
                    const inputSameSalaryElement = labelContainSameSalary.next('select');
                    if (inputSameSalaryElement.length > 0 && inputSameSalaryElement.val() != '') {
                        clearInterval(experienceInterval);

                        await this.delay(200);

                        // Find the first option without a value and select it
                        inputSameSalaryElement.find('option[value="No"]').prop('selected', true);
                    }
                }
            }, 2000);
        },

        submitModelform() {

            var submitButton = setInterval(() => {
                if ($('button[aria-label="Submit application"]').length > 0) {
                    $('button[aria-label="Submit application"]').click();
                    clearInterval(submitButton);
                    clearInterval(clickButtonInterval);
                    setTimeout(() => {
                        console.log('submitModelform', index, job_count);
                        // clearInterval(progrressInterval);
                        modalProcess = document.getElementById("job-auto");
                        modalProcess.style.display = 'none';
                        this.processJobItems(index, job_count);
                    }, 3000);
                }
            }, 2000);
        },

        // Upload a Single File To Input
        uploadSingleFileToInput: async function (fileUrl) {
            console.log('uploadSingleFileToInput');
            var fileInterval = setInterval(async () => {
                clearInterval(fileInterval);
                const inputFileElement = await this.getSelector('input[type="file"]');

                if (inputFileElement.length > 0) {
                    chrome.runtime.sendMessage({ 'type': 'resumeUrl', 'url': fileUrl });
                }
            }, 2000);
        },
        uploadResume: async function (dataArray, fileUrl) {
            console.log('uploadResume');
            console.log(dataArray);
            console.log(fileUrl);
            const fileExtension = this.getFileExtension(fileUrl); // Get the file extension
            const fileType = this.getFileTypeFromExtension(fileExtension); // Get the MIME type based on the extension
            const fileName = `file.${fileExtension}`;
            const dataTransfer = new DataTransfer();
            const file = new File([new Uint8Array(dataArray).buffer], fileName, { type: fileType });
            dataTransfer.items.add(file);
            const inputFileElement = await this.getSelector('input[type="file"]');
            inputFileElement.files = dataTransfer.files;
            inputFileElement.dispatchEvent(new Event("change", { bubbles: true }));
        },

        getSelector: async function (selector) {
            return new Promise((resolve) => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else {
                    const observer = new MutationObserver(() => {
                        const observedElement = document.querySelector(selector);
                        if (observedElement) {
                            resolve(observedElement);
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            });
        },

        jobLocationComfortable() {
            var jobLocationComInterval = setInterval(async () => {
                const labelContainjobComfort = $('legend:contains("Are you comfortable commuting to this job\'s location?") span');

                if (labelContainjobComfort.length > 0) {
                    const inputjobComfortElement = $('input[type="radio"][value="Yes"]');
                    if (inputjobComfortElement.length > 0) {
                        clearInterval(jobLocationComInterval);

                        await this.delay(200);

                        // Find the first option without a value and select it
                        $('input[type="radio"][value="Yes"]').click();;
                    }
                }
            }, 2000);
        },

        comfortablePlace() {

            var comfortablePlaceInterval = setInterval(async () => {
                const labelContainjobComfort = $('legend:contains("Are comfortable coming")');

                if (labelContainjobComfort.length > 0) {
                    const inputjobComfortElement = $('input[type="radio"][value="Yes"]');
                    if (inputjobComfortElement.length > 0) {
                        clearInterval(comfortablePlaceInterval);

                        await this.delay(200);

                        // Find the first option without a value and select it
                        $('input[type="radio"][value="Yes"]').click();;
                    }
                }
            }, 2000);

        },

        configuringManaging() {
            var configuringManagingInterval = setInterval(async () => {
                const labelContainjobComfort = $('label[data-test-text-entity-list-form-title] span:contains("Do you have experience in configuring and managing Infoblox?Do you have experience in configuring and managing Infoblox?") span');

                if (labelContainjobComfort.length > 0) {
                    const configuringManagingElement = $('[id*="text-entity-list-form-component-formElement-urn-li-jobs-applyformcommon-easyApplyFormElement-"]');

                    if (configuringManagingElement.length > 0) {
                        clearInterval(configuringManagingInterval);

                        await this.delay(200);

                        // Find the first option without a value and select it
                        configuringManagingElement.find('option[value="Yes"]').prop('selected', true);
                    }
                }
            }, 2000);
        },

        internPosition() {


            var internPositionInterval = setInterval(async () => {
                const labelinternPosition = $('label[data-test-text-entity-list-form-title] span:contains("This position is for an intern. Are you ready to work as an intern?")');

                if (labelinternPosition.length > 0) {
                    const internPositionElement = $('[id*="text-entity-list-form-component-formElement-urn-li-jobs-applyformcommon-easyApplyFormElement-"]');

                    if (internPositionElement.length > 0) {
                        clearInterval(internPositionInterval);

                        await this.delay(200);

                        // Find the first option without a value and select it
                        internPositionElement.find('option[value="Yes"]').prop('selected', true);
                    }
                }
            }, 2000);
        },



        getFileTypeFromExtension: function (extension) {
            // Implement a function to determine the MIME type based on the file extension
            extension = extension.toLowerCase();
            switch (extension) {
                case "pdf":
                    return "application/pdf";
                case "doc":
                    return "application/msword";
                case "docx":
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                // Add more cases for other supported file types if needed
                default:
                    return "application/octet-stream"; // Default to binary data if type is unknown
            }
        },

        getFileExtension: function (url) {
            // Implement a function to extract the file extension from the URL
            return url.slice(((url.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
        },
        showProcessComplete: function () {
            // Create a popup container
            console.log("i am coming from content")
            var popup = document.createElement("div");
            popup.style.position = "fixed";
            popup.style.left = "0";
            popup.style.top = "0";
            popup.style.width = "100%";
            popup.style.height = "100%";
            popup.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            popup.style.zIndex = "999";
            popup.style.display = "flex";
            popup.style.alignItems = "center";
            popup.style.justifyContent = "center";
            // Create popup content box
            var popupContent = document.createElement("div");
            popupContent.style.backgroundColor = "white";
            popupContent.style.padding = "20px";
            popupContent.style.border = "1px solid #888";
            popupContent.style.width = "300px";
            popupContent.style.textAlign = "center";
            popupContent.style.borderRadius = "10px";
            popupContent.style.position = "relative";
            popupContent.innerHTML = '<p>Congratulations! Your process is complete.</p>';

            // Create a close button
            var closeButton = document.createElement("span");
            closeButton.innerHTML = "X";
            closeButton.className = "closeLinkedInPopUp";
            closeButton.style.color = "#aaa";
            closeButton.style.fontSize = "18px";
            closeButton.style.fontWeight = "bold";
            closeButton.style.cursor = "pointer";
            closeButton.style.position = "absolute";
            closeButton.style.right = "10px";
            closeButton.style.top = "3px";

            // Append close button to popup content
            popupContent.appendChild(closeButton);

            // Append popup content to popup container
            popup.appendChild(popupContent);

            // Append popup to body
            document.body.appendChild(popup);

            // Close the popup when the close button is clicked
            closeButton.onclick = function () {
                popup.remove();
            };

            // Close the popup if clicked outside of the content area
            popup.onclick = function (event) {
                if (event.target == popup) {
                    popup.remove();
                }
            };
        },
        createStopButton: function () {
            console.log("i am coming from content")
            const stopButton = document.createElement("button");
            stopButton.textContent = "Stop";
            stopButton.className = "stop-button";
            stopButton.id = "stopButton"
            stopButton.style.padding = "10px 40px";
            stopButton.style.backgroundColor = "#9e8282";
            stopButton.style.color = "white";
            stopButton.style.border = "none";
            stopButton.style.borderRadius = "5px";
            stopButton.style.marginBottom = "10px";
            stopButton.style.fontSize = "20px";
            stopButton.style.fontWeight = "600";
            stopButton.style.cursor = "pointer";
            stopButton.style.transition = "background-color 0.3s ease";

            const nav = document.querySelector(".global-nav__primary-items");
            if (nav) {
                nav.appendChild(stopButton);
            }
        }


        // setProgressBar: function () {
        //     progrressInterval = setInterval(() => {
        //         if ($('progress.artdeco-completeness-meter-linear__progress-element').length > 0) {
        //             progess = $('progress.artdeco-completeness-meter-linear__progress-element').val();
        //             progressBar.value = progess;
        //         }
        //     }, 2000);
        // }

        //end of functions
    };

    $(document).ready(function () {
        Module.init();

        var applyModal = document.getElementById('apply_modal');
        if (applyModal) {
            applyModal.setAttribute('data-bs-backdrop', 'static');
        }


        $('#apply_modal button.btn-primary').text('Submit');

        if ($('input[name="experience"]').length > 0) {
            var experienceHtml = `<select class="form-select" name="experience" aria-label="Default select">
                                        <option value="">Please select</option>
                                        <option value="Internship">Internship</option>
                                        <option value="Entry level">Entry level</option>
                                        <option value="Associate">Associate</option>
                                        <option value="Mid-Senior level">Mid-Senior level</option>
                                        <option value="Director">Director</option>
                                        <option value="Executive">Executive</option>
                                    </select>`;
            $('input[name="experience"]').after(experienceHtml);
            $('input[name="experience"]').remove();
        }

        if ($('input[name="job_type"]').length > 0) {
            var jobeTypeHtml = `<select class="form-select" name="job_type" aria-label="Default select">
                                        <option value="">Please select</option>
                                        <option value="Full-time">Full-time</option>
                                        <option value="Part-time">Part-time level</option>
                                        <option value="Contract">Contract</option>
                                        <option value="Temporary">Temporary</option>
                                        <option value="Volunteer">Volunteer</option>
                                        <option value="Other">Other</option>
                                    </select>`;
            $('input[name="job_type"]').after(jobeTypeHtml);
            $('input[name="job_type"]').remove();
        }

        if ($('input[name="date_posted"]').length > 0) {
            var datePostedHtml = `<select class="form-select" name="date_posted" aria-label="Default select">
                                        <option value="">Please select </option>
                                        <option value="Past month">Past month</option>
                                        <option value="Past week">Past week</option>
                                        <option value="Past 24 hours">Past 24 hours</option>
                                    </select>`;
            $('input[name="date_posted"]').after(datePostedHtml);
            $('input[name="date_posted"]').remove();
        }

        const jobCountInput = $('#job_count');
        if (jobCountInput.length > 0) {
            jobCountInput
                .val(1)
                .attr('type', 'number')
                .attr('min', 1)
                .attr('max', 10)
                .attr('placeholder', 1);
        }

    });
})(jQuery);


// CLICK ON MESSENGER TEXT AREA BOX. (FOR SEND MESSAGES)
async function clickOnElements(element) {
    console.log(element);
    let MouseEvent = document.createEvent("MouseEvents");
    MouseEvent.initEvent("mouseover", true, true);
    const over = document.querySelector(element).dispatchEvent(MouseEvent);
    //await sleep(50);
    MouseEvent.initEvent("mousedown", true, true);
    const down = document.querySelector(element).dispatchEvent(MouseEvent);
    MouseEvent.initEvent("mouseup", true, true);
    const up = document.querySelector(element).dispatchEvent(MouseEvent);
    MouseEvent.initEvent("click", true, true);
    const click = document.querySelector(element).dispatchEvent(MouseEvent);
    console.log(over, down, up, click);

    if (over) {
        return new Promise((resolve) => {
            resolve();
        });
    } else {
        return await clickOnElements(element);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
$(document).on("click", '#stopButton', function () {
    console.log("stop");
    let processStart = "";
    var data = {
        process_start: processStart
    };
    chrome.storage.local.set({ jobData: data }, function () {
        console.log("Data saved to Chrome storage:", data);
    });
    chrome.runtime.sendMessage({
        type: 'stop_background_proccess',
    })
})
$(document).on("click", '.closeLinkedInPopUp', function () {
    console.log("close");

    chrome.runtime.sendMessage({
        type: 'stop_linkedIn_proccess',
    })
})
