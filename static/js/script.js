// static/js/script.js

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// --- Globals ---
// Store current analysis data (accessible by chatbot)
let currentAnalysisResults = null;
// History and Marketplace data
let analysisHistory = [];
let marketplaceItems = []; // Using window scope as in original for demo simplicity

// --- Main Initialization ---
function init() {
  console.log("Initializing SentimentChain...");
  // Initialize Feather icons
  if (typeof feather !== 'undefined') {
    feather.replace();
    console.log("Feather icons replaced.");
  } else {
    console.warn('Feather icons library not loaded or executed yet.');
    // Retry Feather initialization slightly later if it wasn't ready
    setTimeout(() => {
        if (typeof feather !== 'undefined') {
             feather.replace();
             console.log("Feather icons replaced (retry).");
        } else {
             console.error('Feather icons failed to load.');
        }
    }, 500);
  }

  // Set up event listeners for main app and chatbot
  setupEventListeners();

  // Set up tabs
  setupTabs();

  // Check theme preference
  checkThemePreference();

  // Check wallet connection (if blockchain.js is loaded and functions exist)
  if (typeof checkWalletConnection === 'function') {
    checkWalletConnection();
  } else {
    console.warn("blockchain.js or checkWalletConnection function not found.");
  }

  // Load data from localStorage
  loadFromLocalStorage();

  // Populate history and marketplace tabs
  populateHistoryTab();
  populateMarketplaceTab();

  console.log("Initialization complete.");
}

// --- Event Listener Setup ---
function setupEventListeners() {
  console.log("Setting up event listeners...");

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if(themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Connect wallet button
  const connectWalletBtn = document.getElementById('connectWallet');
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', () => {
      if (typeof connectWallet === 'function') {
        connectWallet();
      } else {
        alert('Blockchain functionality (connectWallet) not available.');
        console.error('connectWallet function not found.');
      }
    });
  } else { console.warn("Connect Wallet button not found"); }

  // Analyze button
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.addEventListener('click', performAnalysis);
  else { console.warn("Analyze button not found"); }

  // Store on blockchain button
  const storeOnChainBtn = document.getElementById('storeOnChain');
  if (storeOnChainBtn) {
    storeOnChainBtn.addEventListener('click', async () => {
      if (!currentAnalysisResults) {
          alert("Please perform an analysis before storing.");
          return;
      }
      if (typeof storeAnalysisOnBlockchain === 'function') {
        // Pass the current results to the blockchain function
        const result = await storeAnalysisOnBlockchain(currentAnalysisResults);
        if (result && result.transactionHash) { // Check for transaction hash
          // Update the specific history item with blockchain data
          const historyIndex = analysisHistory.findIndex(item => item.timestamp === currentAnalysisResults.timestamp);
          if (historyIndex !== -1) {
              analysisHistory[historyIndex].blockchainData = {
                  transactionHash: result.transactionHash,
                  // Add other relevant data like block number if available
              };
              console.log("Blockchain data added to history item:", analysisHistory[historyIndex]);
              saveToLocalStorage();
              populateHistoryTab(); // Refresh tab to show "ON BLOCKCHAIN" status
              // Optionally display success message with tx hash
              const txInfo = document.getElementById('transactionInfo');
              if(txInfo) {
                   // IMPORTANT: Adjust the explorer URL to the correct one for L1X if different
                   txInfo.innerHTML = `Successfully stored! <a href="https://explorer.l1x.foundation/tx/${result.transactionHash}" target="_blank" rel="noopener noreferrer">View Transaction</a>`;
              }

          } else {
              console.error("Could not find matching history item to update blockchain status.");
          }
        } else {
            console.log("Storing on blockchain did not return a transaction hash or failed.");
            // Handle potential errors shown to the user by storeAnalysisOnBlockchain
             // Example: If storeAnalysisOnBlockchain returns null or { error: ... }
             if(result && result.error) {
                 alert(`Failed to store on blockchain: ${result.error}`);
             } else if (!result?.transactionHash) {
                 // Don't show generic alert if blockchain.js handled it, but maybe log
                 console.log("Store on blockchain process completed without success or tx hash.");
             }
        }
      } else {
        alert('Blockchain functionality (storeAnalysisOnBlockchain) not available.');
        console.error('storeAnalysisOnBlockchain function not found.');
      }
    });
  } else { console.warn("Store on Chain button not found"); }

  // File input change
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
          console.log(`File selected: ${file.name}, type: ${file.type}`);
          // Allow common text/csv MIME types and extensions
          const allowedTypes = ['text/csv', 'text/plain', 'application/vnd.ms-excel'];
          const allowedExtensions = ['.csv', '.txt'];
          const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

          if (allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)) {
              readFileContent(file)
              .then(content => {
                  document.getElementById('textInput').value = content;
                  console.log("File content loaded into text area.");
              })
              .catch(error => {
                  console.error('Error reading file:', error);
                  alert(`Failed to read file: ${error.message}. Please try again.`);
              });
          } else {
              alert(`Unsupported file type: ${file.type || fileExtension}. Please select a CSV or TXT file.`);
              fileInput.value = ''; // Clear the input
          }
      }
    });
  } else { console.warn("File input not found"); }

  // URL input + fetch simulation (Enter key)
  const urlInput = document.getElementById('urlInput');
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = e.target.value.trim();
        if (isValidUrl(url)) {
            console.log("Fetching content for URL (Enter key):", url);
            fetchWebContent(url); // Call fetch function
        } else if (url) {
            alert("Please enter a valid URL (e.g., https://example.com)");
        }
      }
    });
  } else { console.warn("URL input not found"); }

  // List data button (marketplace)
  const listDataBtn = document.getElementById('listDataBtn');
  if (listDataBtn) {
    listDataBtn.addEventListener('click', openListingModal);
  } else { console.warn("List Data button not found"); }

  // Marketplace category filter buttons
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterMarketplaceItems(btn.dataset.category);
    });
  });

  // History filter inputs
  const historyFilter = document.getElementById('historyFilter');
  const historySearch = document.getElementById('historySearch');
  if (historyFilter) historyFilter.addEventListener('change', filterHistory);
  else { console.warn("History filter select not found"); }
  if (historySearch) historySearch.addEventListener('input', filterHistory);
  else { console.warn("History search input not found"); }

  // --- Chatbot Event Listeners ---
  const chatbotButton = document.getElementById('chatbot-button');
  const chatbotWidget = document.getElementById('chatbot-widget');
  const closeButton = document.getElementById('chatbot-close-button');
  const sendButton = document.getElementById('chatbot-send-button');
  const messageInput = document.getElementById('chatbot-input');
  const messagesContainer = document.getElementById('chatbot-messages'); // Get messages container

  if(chatbotButton && chatbotWidget && closeButton && sendButton && messageInput && messagesContainer) {
      // Toggle Chat Widget
      chatbotButton.addEventListener('click', () => {
          const isHidden = chatbotWidget.style.display === 'none' || chatbotWidget.style.display === '';
          chatbotWidget.style.display = isHidden ? 'flex' : 'none';
          if (isHidden) {
               // Add initial greeting if messages empty
               if(messagesContainer.children.length === 0) {
                    appendChatMessage("Hi! How can I help you with the current analysis?", 'bot');
               }
               // Scroll existing messages into view smoothly
                messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
               messageInput.focus();
          }
          console.log("Chatbot toggled:", isHidden ? "Visible" : "Hidden");
      });

      // Close Chat Widget
      closeButton.addEventListener('click', () => {
          chatbotWidget.style.display = 'none';
          console.log("Chatbot closed.");
      });

      // Send Message Button
      sendButton.addEventListener('click', sendChatMessage);

      // Send Message on Enter Key
      messageInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault(); // Prevent default Enter behavior (like form submission)
              sendChatMessage();
          }
      });
      console.log("Chatbot event listeners set up.");
  } else {
      console.error("One or more chatbot elements not found. Chatbot UI might not work.", {
          chatbotButton, chatbotWidget, closeButton, sendButton, messageInput, messagesContainer
      });
  }

  console.log("Event listener setup complete.");
}

// --- Tabs Functionality ---
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  if(tabButtons.length === 0 || tabContents.length === 0) {
      console.error("Tab buttons or content areas not found.");
      return;
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      console.log(`Switching to tab: ${tabName}`);

      // Remove active class from all buttons and hide all contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.add('hidden'));

      // Add active class to clicked button and show corresponding content
      button.classList.add('active');
      const activeTabContent = document.getElementById(`${tabName}-tab`);
      if (activeTabContent) {
          activeTabContent.classList.remove('hidden');
      } else {
          console.error(`Tab content for '${tabName}' not found.`);
      }

      // Re-initialize Feather icons if needed after content change
      if (typeof feather !== 'undefined') {
          feather.replace();
      }
    });
  });
  console.log("Tabs setup complete.");
}

// --- Theme Management ---
function checkThemePreference() {
  const darkModePreferred = localStorage.getItem('darkMode') === 'true';
  applyTheme(darkModePreferred);
  console.log("Checked theme preference. Dark mode:", darkModePreferred);
}

function toggleTheme() {
  const isDarkMode = document.body.classList.toggle('dark-mode');
  applyTheme(isDarkMode);
  localStorage.setItem('darkMode', isDarkMode);
  console.log("Toggled theme. Dark mode:", isDarkMode);

  // Update chart colors if charts are initialized and function exists
  // Check if Chart object exists and then if specific chart instances exist
  if (typeof Chart !== 'undefined' && typeof updateChartColorsWithTheme === 'function') {
      // Check for specific chart instances if needed, e.g., window.sentimentChart
      updateChartColorsWithTheme();
      console.log("Updated chart colors for theme change.");
  }
}

function applyTheme(isDarkMode) {
    const themeToggle = document.getElementById('themeToggle');
    if(themeToggle) themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
    // Class is toggled in toggleTheme, this just sets the button text
}


// --- Core Analysis Logic ---
async function performAnalysis() {
  console.log("Starting analysis...");
  const textInput = document.getElementById('textInput');
  const urlInput = document.getElementById('urlInput');
  const keywordInput = document.getElementById('keywordInput');
  const modelSelect = document.getElementById('modelSelect');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const resultsContainer = document.getElementById('resultsContainer');
  const storeOnChainBtn = document.getElementById('storeOnChain');
  const listDataBtn = document.getElementById('listDataBtn');

  // Get input values
  const text = textInput.value.trim();
  const url = urlInput.value.trim();
  const keyword = keywordInput.value.trim();
  const model = modelSelect.value;

  // Validate input
  if (!text && !url) {
    alert('Please provide text to analyze or enter a URL to fetch content.');
    console.warn("Analysis aborted: No text or URL provided.");
    return;
  }
  if (url && !isValidUrl(url)) {
    alert("The entered URL does not appear valid. Please check it (e.g., include https://).");
    console.warn("Analysis aborted: Invalid URL provided.");
    return;
  }

  // Show loading state
  analyzeBtn.disabled = true;
  // Use innerHTML to include the icon
  analyzeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-loader spin" style="vertical-align: middle; margin-right: 5px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>Analyzing...`;
  // Add spin animation class if not already defined in CSS
   if (!document.getElementById('spin-animation-style')) {
        const style = document.createElement('style');
        style.id = 'spin-animation-style';
        style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`;
        document.head.appendChild(style);
    }

  resultsContainer.classList.add('hidden'); // Hide previous results
   // Reset blockchain button state
  if(storeOnChainBtn) storeOnChainBtn.disabled = true;
  if(listDataBtn) listDataBtn.disabled = true;
  const txInfo = document.getElementById('transactionInfo');
  if(txInfo) txInfo.innerHTML = ''; // Clear previous tx info


  try {
    let contentToAnalyze = text;
    let originalFullText = text; // Store original text input initially
      let payload = {};
    // Fetch content from URL if URL is provided and text area is empty
    if (url && !text) {
      console.log("Fetching content from URL:", url);
      const fetchedContent = await fetchWebContent(url); // Assuming fetchWebContent updates the textarea
      if (!fetchedContent) {
        // Error handled within fetchWebContent
        throw new Error('URL fetch failed or returned empty content.'); // Abort analysis
      }
       // Update the text variable after fetch
       contentToAnalyze = document.getElementById('textInput').value.trim();
       originalFullText = contentToAnalyze; // Update original text to fetched content
       if (!contentToAnalyze) {
           throw new Error('Fetched content is empty.');
       }
    }

    // Apply keyword filtering if provided
    if (keyword && contentToAnalyze) {
      console.log("Applying keyword filter:", keyword);
      // Improved sentence splitting regex
      const sentences = contentToAnalyze.match(/([^\.!\?]+[\.!\?]*)/g) || [contentToAnalyze];
      const filteredSentences = sentences.filter(sentence =>
        sentence.toLowerCase().includes(keyword.toLowerCase())
      );

      if (filteredSentences.length === 0) {
        alert(`No sentences found containing the keyword "${keyword}". Analysis will proceed on the full text.`);
        console.warn(`Keyword "${keyword}" not found in any sentence.`);
        // Keep contentToAnalyze as originalFullText
      } else {
        contentToAnalyze = filteredSentences.join(' ').trim(); // Join matching sentences
        console.log("Filtered content length:", contentToAnalyze.length);
        // NOTE: originalFullText still holds the pre-filtering text
      }
    }

    if (!contentToAnalyze) {
        alert("Content to analyze is empty after filtering or fetching.");
        throw new Error('Empty content.');
    }

    // Start timer for analysis
    const startTime = performance.now();

    // Perform analysis based on selected model
    let results;
    console.log("Performing analysis with model:", model);
    if (model === 'advanced') {
      results = await performAdvancedAnalysis(contentToAnalyze);
    } else if (model === 'blockchain') {
      results = await performBlockchainConsensusAnalysis(contentToAnalyze);
    } else { // Default to basic
      results = await performBasicAnalysis(contentToAnalyze);
    }

    // Calculate analysis time
    const analysisTime = performance.now() - startTime;
    console.log(`Analysis completed in ${analysisTime.toFixed(0)}ms`);

    // Update UI with results
    updateAnalysisResultsUI(results, analysisTime);
    resultsContainer.classList.remove('hidden'); // Show results

    // Store current analysis globally (for chatbot and potential listing)
    currentAnalysisResults = {
      // Store snippet of the *original* text before filtering for context
      text: originalFullText.substring(0, 1000) + (originalFullText.length > 1000 ? '...' : ''), // Increased snippet length
      results: results, // The actual analysis results
      timestamp: new Date().toISOString(),
      model: model,
      keyword: keyword || null // Store keyword used, if any
    };
    console.log("Current analysis results stored globally.");

    // Add to history
    addToHistory(currentAnalysisResults);

    // Enable blockchain/marketplace buttons if wallet is connected
    if (typeof isWalletConnected === 'function' && isWalletConnected()) {
       if(storeOnChainBtn) storeOnChainBtn.disabled = false;
       if(listDataBtn) listDataBtn.disabled = false;
       console.log("Wallet connected, enabling Store and List buttons.");
    } else {
        console.log("Wallet not connected, Store and List buttons remain disabled.");
    }

  } catch (error) {
    console.error('Analysis error:', error);
    alert('Error during analysis: ' + error.message);
    resultsContainer.classList.add('hidden'); // Hide results container on error
  } finally {
    // Reset button state
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = 'Analyze'; // Reset button text (removes icon)
    console.log("Analysis function finished.");
  }
}

// --- Helper Functions ---

// Read file content
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      resolve(event.target.result);
    };
    reader.onerror = function(event) {
      // Provide more specific error if possible
      console.error("FileReader Error:", event.target.error);
      reject(new Error(`FileReader error: ${event.target.error.name || 'Unknown error'}`));
    };
    reader.readAsText(file);
  });
}

// Validate URL
function isValidUrl(string) {
    // Basic check for http:// or https:// followed by something
    const pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(string);
}

// Fetch web content (Simulation)
async function fetchWebContent(url) {
  const textInput = document.getElementById('textInput');
  const originalPlaceholder = textInput.placeholder;
  const originalValue = textInput.value; // Keep original value if user typed something
  textInput.value = ''; // Clear existing text
  textInput.placeholder = 'Fetching content from URL... Please wait...';
  textInput.disabled = true; // Disable textarea while fetching

  try {
    console.log(`Simulating fetch for: ${url}`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000)); // Add some randomness

    // For demo purposes, generate sample content based on the URL
    // (Keep your existing simulation logic here)
     let sampleContent;
    if (url.includes('crypto') || url.includes('bitcoin') || url.includes('blockchain') || url.includes('l1x')) {
      sampleContent = `Cryptocurrency markets showed significant volatility today as Bitcoin surged to new highs. Analysts attribute this growth to institutional adoption and positive regulatory developments. Meanwhile, L1X blockchain continues to gain traction with its innovative approach to scaling and security. Experts believe that the integration of AI and blockchain technologies, as demonstrated by L1X, represents the future of the industry. Investors remain optimistic about the long-term prospects of the crypto market despite short-term fluctuations. The sentiment is generally positive but cautious.`;
    } else if (url.includes('news') || url.includes('article')) {
      sampleContent = `Breaking news: Global markets reacted strongly to recent economic data, with stocks experiencing significant gains. The technology sector led the rally, with AI and blockchain companies showing particularly strong performance. Environmental concerns continue to shape policy discussions, with new initiatives aimed at reducing carbon emissions. This leads to some negative outlooks. Healthcare innovations are accelerating, promising improved treatment options. Political tensions remain a concern. Overall a neutral to positive view.`;
    } else if (url.includes('review') || url.includes('product')) {
      sampleContent = `Product Review: The latest smartphone model exceeds expectations with its innovative features and improved battery life. This is great. However, the high price point may deter some consumers, which is bad. The camera quality is exceptional, capturing detailed images. The user interface is intuitive. Some users reported minor software glitches, unfortunately. Overall, this product represents a significant advancement, making it a positive experience.`;
    } else {
      sampleContent = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam in dui mauris. Vivamus hendrerit arcu sed erat molestie vehicula. Sed auctor neque eu tellus rhoncus ut eleifend nibh porttitor. Ut in nulla enim. Phasellus molestie magna non est bibendum non venenatis nisl tempor. Suspendisse dictum feugiat nisl ut dapibus. Mauris iaculis porttitor posuere. Praesent id metus massa, ut blandit odio. Proin quis tortor orci. Etiam at risus et justo dignissim congue. Donec congue lacinia dui, a porttitor lectus condimentum laoreet. Neutral text example for analysis demonstration purposes.`;
    }

    // Update text area with fetched content
    textInput.value = sampleContent;
    console.log("Simulated fetch successful, content added to textarea.");
    return sampleContent; // Return the content

  } catch (error) {
    console.error('Error simulating web content fetch:', error);
    // Restore original value if any, otherwise clear
    textInput.value = originalValue;
    alert(`Failed to fetch content (simulation): ${error.message}`);
    return null; // Indicate failure
  } finally {
      // Restore placeholder and enable textarea
      textInput.placeholder = originalPlaceholder;
      textInput.disabled = false;
  }
}

// --- Sentiment Analysis Simulations ---

// Perform basic sentiment analysis (Simulation - Refined Logic)
async function performBasicAnalysis(text) {
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random()*500)); // Faster simulation
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'terrific', 'outstanding', 'brilliant', 'positive', 'success', 'successful', 'happy', 'glad', 'joy', 'love', 'best', 'better', 'impressive', 'win', 'winning', 'progress', 'improve', 'improved', 'beneficial', 'benefit', 'favorite', 'like', 'recommend', 'exceeds', 'exceptional', 'intuitive', 'advancement', 'optimistic', 'strong', 'gains', 'accelerating', 'traction'];
  const negativeWords = ['bad', 'awful', 'terrible', 'horrible', 'poor', 'negative', 'fail', 'failure', 'disappointing', 'disappointed', 'sad', 'unhappy', 'hate', 'dislike', 'worst', 'worse', 'problem', 'difficult', 'difficulty', 'trouble', 'unfortunately', 'hurt', 'damage', 'painful', 'annoying', 'annoy', 'angry', 'mad', 'upset', 'deter', 'glitches', 'cautious', 'concerns', 'tensions', 'fluctuations', 'issues', 'bug'];
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  let positiveCount = 0;
  let negativeCount = 0;
  words.forEach(word => {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  });

  const totalWords = words.length;
  if (totalWords === 0) return { sentiment: 'Neutral', confidence: 0, positive_percentage: 0, negative_percentage: 0, neutral_percentage: 100, key_topics: [] };

  // Simple scoring: +1 for positive, -1 for negative
  const score = positiveCount - negativeCount;
  // Normalize score based on total sentiment words found
  const totalSentimentWords = positiveCount + negativeCount;
  const normalizedScore = totalSentimentWords > 0 ? score / totalSentimentWords : 0; // Score from -1 to 1

  let sentiment;
  let posPerc, negPerc, neuPerc;

  // Determine sentiment based on score thresholds
  if (normalizedScore > 0.1) { // Leaning positive
    sentiment = 'Positive';
    posPerc = 50 + (normalizedScore * 45); // Scale score to 50-95 range
    negPerc = Math.max(5, 20 - (normalizedScore * 15)); // Decrease negative as positive increases
  } else if (normalizedScore < -0.1) { // Leaning negative
    sentiment = 'Negative';
    negPerc = 50 + (Math.abs(normalizedScore) * 45); // Scale score to 50-95 range
    posPerc = Math.max(5, 20 - (Math.abs(normalizedScore) * 15)); // Decrease positive as negative increases
  } else { // Neutral
    sentiment = 'Neutral';
    // Closer to even split for neutral
    posPerc = 30 + normalizedScore * 100; // Center around 30% based on slight bias
    negPerc = 30 - normalizedScore * 100;
  }

  // Calculate neutral and ensure sum is 100
  neuPerc = 100 - posPerc - negPerc;

  // Clamp percentages between 0 and 100 and re-normalize
  posPerc = Math.max(0, Math.min(100, posPerc));
  negPerc = Math.max(0, Math.min(100, negPerc));
  neuPerc = Math.max(0, Math.min(100, neuPerc)); // Ensure neutral is not negative

  const totalPerc = posPerc + negPerc + neuPerc;
  if (totalPerc > 0) {
      posPerc = (posPerc / totalPerc) * 100;
      negPerc = (negPerc / totalPerc) * 100;
      neuPerc = (neuPerc / totalPerc) * 100;
  } else { // Should not happen if totalWords > 0, but safety check
      posPerc = 0; negPerc = 0; neuPerc = 100;
  }

  // Confidence: Higher if score is further from 0 and more sentiment words found
  let confidence = Math.abs(normalizedScore) * 60 + Math.min(40, Math.log1p(totalSentimentWords) * 10);
  confidence = Math.max(10, Math.min(98, confidence)); // Clamp confidence 10-98

  return {
    sentiment,
    confidence: parseFloat(confidence.toFixed(1)),
    positive_percentage: parseFloat(posPerc.toFixed(1)),
    negative_percentage: parseFloat(negPerc.toFixed(1)),
    neutral_percentage: parseFloat(neuPerc.toFixed(1)),
    key_topics: extractKeyTopics(text)
  };
}

// Extract key topics (Simulation - Using refined categories)
function extractKeyTopics(text) {
  const topicCategories = {
    'Finance/Markets': ['money', 'bank', 'invest', 'stock', 'market', 'economic', 'finance', 'financial', 'economy', 'price', 'cost', 'dollar', 'euro', 'payment', 'tax', 'taxes', 'revenue', 'gains', 'budget', 'growth', 'adoption', 'figures', 'funds', 'valuation', 'profit', 'loss'],
    'Technology/AI': ['tech', 'technology', 'computer', 'software', 'hardware', 'app', 'application', 'digital', 'internet', 'online', 'website', 'electronic', 'device', 'smartphone', 'laptop', 'ai', 'artificial intelligence', 'code', 'programming', 'innovative', 'features', 'interface', 'advancement', 'developments', 'data', 'algorithm', 'module', 'platform', 'system'],
    'Blockchain/Crypto': ['blockchain', 'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'token', 'wallet', 'defi', 'nft', 'decentralized', 'l1x', 'mining', 'hash', 'ledger', 'smart contract', 'volatility', 'surged', 'scaling', 'security', 'integration', 'consensus', 'validator', 'adoption', 'transaction', 'gas', 'dapp'],
    'Health/Medical': ['health', 'healthcare', 'medical', 'medicine', 'doctor', 'hospital', 'patient', 'treatment', 'disease', 'illness', 'symptom', 'cure', 'recovery', 'wellness', 'fitness', 'diet', 'exercise', 'innovations', 'pharma', 'clinical', 'trial'],
    'Environment/Policy': ['environment', 'environmental', 'climate', 'pollution', 'renewable', 'sustainable', 'green', 'eco', 'ecology', 'recycle', 'energy', 'carbon', 'emission', 'conservation', 'nature', 'policy', 'regulatory', 'government', 'initiatives', 'global'],
    'Product/Review': ['product', 'review', 'consumer', 'quality', 'features', 'battery', 'camera', 'price', 'software', 'glitches', 'users', 'experience', 'model', 'expectations', 'design', 'performance', 'comparison', 'rating', 'feedback'],
    'News/Politics': ['news', 'article', 'global', 'political', 'tensions', 'relations', 'policy', 'government', 'discussions', 'data', 'report', 'breaking', 'world', 'local', 'election', 'campaign', 'update', 'media'],
    'Business/Corporate': ['business', 'company', 'corporate', 'market', 'strategy', 'management', 'customer', 'service', 'sales', 'marketing', 'campaign', 'launch', 'brand', 'competitor', 'industry', 'meeting', 'project', 'deadline', 'collaboration'],
  };
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []; // Get words (min length 3)
  const wordCounts = {};
  words.forEach(word => { wordCounts[word] = (wordCounts[word] || 0) + 1; });

  const topicScores = {};
  let totalScore = 0;
  for (const [topic, keywords] of Object.entries(topicCategories)) {
    topicScores[topic] = 0;
    keywords.forEach(keyword => {
      if (wordCounts[keyword]) {
        topicScores[topic] += wordCounts[keyword]; // Simple count for score
      }
    });
    totalScore += topicScores[topic];
  }

  // Get top 5 topics with score > 0, calculate percentage
  const sortedTopicsData = Object.entries(topicScores)
    .filter(([topic, score]) => score > 0)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, 5)
    .map(([topic, score]) => ({
        topic: topic,
        // Calculate percentage of total score (optional, might be useful for radar chart)
        percentage: totalScore > 0 ? parseFloat(((score / totalScore) * 100).toFixed(1)) : 0
    }));

   // If no topics found, return a default
   if (sortedTopicsData.length === 0 && text.length > 0) {
       return [{ topic: 'General', percentage: 100 }];
   }

  // Return array of topic names (for basic display) or full data (for charts)
  // Let's return just names for now for simplicity in UI update
  return sortedTopicsData.map(data => data.topic);
  // To return full data for charts: return sortedTopicsData;
}

// Perform advanced analysis (Simulation - Refined)
async function performAdvancedAnalysis(text) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Analysis failed with status ${response.status}`);
    }

    return {
      sentiment: data.sentiment || 'Neutral',
      confidence: (data.confidence * 100) || 0, // Convert to percentage
      positive_percentage: data.details.filter(d => d.sentiment === 'positive').length / data.details.length * 100 || 0,
      negative_percentage: data.details.filter(d => d.sentiment === 'negative').length / data.details.length * 100 || 0,
      neutral_percentage: data.details.filter(d => d.sentiment === 'neutral').length / data.details.length * 100 || 0,
      key_topics: extractKeyTopics(text),
      details: data.details,
      hate_speech: data.hate_speech,
      model: 'advanced'
    };

  } catch (error) {
    console.error('Advanced analysis error:', error);
    return {
      sentiment: 'Error',
      confidence: 0,
      error: error.message
    };
  }
}


// Perform blockchain consensus analysis (Simulation - Refined)
async function performBlockchainConsensusAnalysis(text) {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random()*1000)); // Longest delay
  const numValidators = 5 + Math.floor(Math.random() * 6); // Simulate 5-10 validators
  const validatorResults = [];

  for (let i = 0; i < numValidators; i++) {
    // Simulate slight variations in basic analysis for each validator
    const basic = await performBasicAnalysis(text);
    // Apply more variance to percentages
    const posVar = (Math.random() - 0.5) * 0.3; // +/- 15% variation
    const negVar = (Math.random() - 0.5) * 0.3;
    let vPos = Math.max(0, Math.min(100, basic.positive_percentage * (1 + posVar)));
    let vNeg = Math.max(0, Math.min(100, basic.negative_percentage * (1 + negVar)));
    let vNeu = Math.max(0, 100 - vPos - vNeg);
    // Re-normalize validator percentages
    const vTotal = vPos + vNeg + vNeu;
     if(vTotal > 0) {
         vPos = (vPos/vTotal) * 100;
         vNeg = (vNeg/vTotal) * 100;
         vNeu = (vNeu/vTotal) * 100;
     }
     // Determine validator's sentiment based on its *own* varied results
     let vSentiment = 'Neutral';
     if (vPos > vNeg && vPos > vNeu + 5) vSentiment = 'Positive'; // Add buffer over neutral
     else if (vNeg > vPos && vNeg > vNeu + 5) vSentiment = 'Negative';

    validatorResults.push({
        sentiment: vSentiment,
        positive_percentage: vPos,
        negative_percentage: vNeg,
        neutral_percentage: vNeu
    });
  }

  // Calculate consensus
  const sentimentCounts = { 'Positive': 0, 'Negative': 0, 'Neutral': 0 };
  let totalPositive = 0;
  let totalNegative = 0;
  let totalNeutral = 0;

  validatorResults.forEach(result => {
    sentimentCounts[result.sentiment]++;
    totalPositive += result.positive_percentage;
    totalNegative += result.negative_percentage;
    totalNeutral += result.neutral_percentage;
  });

  // Determine consensus sentiment (majority vote)
  let consensusSentiment = 'Neutral'; // Default
  if (sentimentCounts['Positive'] >= sentimentCounts['Negative'] && sentimentCounts['Positive'] >= sentimentCounts['Neutral']) {
    consensusSentiment = 'Positive';
  } else if (sentimentCounts['Negative'] > sentimentCounts['Positive'] && sentimentCounts['Negative'] >= sentimentCounts['Neutral']) {
    consensusSentiment = 'Negative';
  } // Else remains Neutral

  // Calculate average percentages
  const avgPositive = totalPositive / numValidators;
  const avgNegative = totalNegative / numValidators;
  const avgNeutral = totalNeutral / numValidators;

  // Calculate consensus level (percentage agreement on the majority sentiment)
  const consensusLevel = (sentimentCounts[consensusSentiment] / numValidators) * 100;

  return {
    sentiment: consensusSentiment,
    confidence: parseFloat(consensusLevel.toFixed(1)), // Confidence is the consensus level
    positive_percentage: parseFloat(avgPositive.toFixed(1)),
    negative_percentage: parseFloat(avgNegative.toFixed(1)),
    neutral_percentage: parseFloat(avgNeutral.toFixed(1)),
    consensus_level: parseFloat(consensusLevel.toFixed(1)),
    validator_count: numValidators,
    key_topics: extractKeyTopics(text), // Use same topic extraction
    model: 'blockchain'
  };
}


// --- UI Update Functions ---

// Update UI with analysis results
function updateAnalysisResultsUI(results, analysisTime) {
  console.log("Updating UI with analysis results:", results);
  const resultsContainer = document.getElementById('resultsContainer');
  if (!resultsContainer) return; // Exit if container not found
  resultsContainer.classList.remove('hidden');

  // Update summary cards safely
  const overallSentimentEl = document.getElementById('overallSentiment');
  const confidenceScoreEl = document.getElementById('confidenceScore');
  const analysisTimeEl = document.getElementById('analysisTime');

  if (overallSentimentEl) {
      overallSentimentEl.textContent = results.sentiment || 'N/A';
      // Clear previous sentiment classes and add the new one
      overallSentimentEl.className = 'sentiment-indicator'; // Reset class
      if (results.sentiment) {
           overallSentimentEl.classList.add(results.sentiment.toLowerCase());
      }
  }
  if (confidenceScoreEl) {
       confidenceScoreEl.textContent = (results.confidence !== undefined ? results.confidence.toFixed(1) : 'N/A') + '%';
  }
   if (analysisTimeEl) {
       analysisTimeEl.textContent = (analysisTime !== undefined ? analysisTime.toFixed(0) : 'N/A') + 'ms';
   }

  // Update charts if chart.js functions are available
  if (typeof updateCharts === 'function') {
      try {
          updateCharts(results); // Pass the full results object
          console.log("Charts updated.");
      } catch(chartError) {
          console.error("Error updating charts:", chartError);
      }
  } else {
      console.warn("updateCharts function not found (is charts.js loaded correctly?).");
  }
}


// --- History Management ---

// Add analysis to history
function addToHistory(analysisResult) {
  // Ensure no duplicates based on timestamp (simple check)
  if(analysisHistory.length > 0 && analysisHistory[0].timestamp === analysisResult.timestamp) {
      console.log("Skipping duplicate history entry based on timestamp.");
      return;
  }

  analysisHistory.unshift(analysisResult); // Add to beginning

  // Limit history size (e.g., keep last 50)
  const MAX_HISTORY = 50;
  if (analysisHistory.length > MAX_HISTORY) {
    analysisHistory.pop(); // Remove the oldest item
  }

  saveToLocalStorage(); // Save updated history
  populateHistoryTab(); // Refresh the UI
  console.log("Analysis added to history. History size:", analysisHistory.length);
}

// Populate history tab UI
function populateHistoryTab() {
  const historyList = document.getElementById('historyList');
  if (!historyList) {
      console.error("History list element not found.");
      return;
  }

  historyList.innerHTML = ''; // Clear current list

  if (analysisHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-state">
        <i data-feather="inbox"></i>
        <p>No analysis history yet. Perform an analysis to see it here!</p>
      </div>
    `;
  } else {
    analysisHistory.forEach((item, index) => {
      // Defensive check for item structure
      if (!item || !item.timestamp || !item.results || !item.text) {
           console.warn("Skipping invalid history item:", index, item);
           return;
      }
      const timestamp = new Date(item.timestamp).toLocaleString();
      const results = item.results;
      const sentimentClass = results.sentiment ? results.sentiment.toLowerCase() : 'neutral'; // Default class
      const confidenceText = results.confidence !== undefined ? results.confidence.toFixed(1) + '%' : 'N/A';
      const txHash = item.blockchainData?.transactionHash; // Use optional chaining

      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      // Add data attributes for filtering
      historyItem.setAttribute('data-sentiment', sentimentClass);
      historyItem.setAttribute('data-text', item.text.toLowerCase());
      historyItem.setAttribute('data-blockchain', item.blockchainData ? 'true' : 'false');


      historyItem.innerHTML = `
        <div class="history-item-content">
          <div class="history-item-header">
            <span class="history-timestamp">${timestamp}</span>
            <div> <!-- Wrapper for right-aligned items -->
                <span class="history-model">${item.model || 'basic'}</span>
                ${txHash ? `<span class="history-blockchain" title="Tx Hash: ${txHash}">ON CHAIN</span>` : ''}
            </div>
          </div>
          <div class="history-text" title="${item.text.replace(/</g, "<").replace(/>/g, ">")}">${item.text}</div> <!-- Add title for full text, escape HTML -->
          <div class="history-sentiment sentiment-${sentimentClass}">
            ${results.sentiment || 'N/A'} (${confidenceText} conf.)
          </div>
          ${item.keyword ? `<div class="history-keyword" style="font-size:0.8em; opacity:0.7; margin-top: 4px;">Keyword: "${item.keyword}"</div>` : ''}
        </div>
        <div class="history-item-actions">
           <!-- Use data-index attribute to identify item for reanalysis -->
          <button class="history-action-btn" data-index="${index}" onclick="reanalyzeFromHistory(this.dataset.index)">Reanalyze</button>
        </div>
      `;
      historyList.appendChild(historyItem);
    });
  }

  // Re-initialize Feather icons if needed
  if (typeof feather !== 'undefined') {
    feather.replace();
  }

  // Apply current filter after populating
  filterHistory();
}


// Filter history items based on dropdown and search input
function filterHistory() {
  const historyList = document.getElementById('historyList');
   if (!historyList) return; // Element not found

  const filterValue = document.getElementById('historyFilter')?.value || 'all';
  const searchText = document.getElementById('historySearch')?.value.toLowerCase() || '';
  const historyItems = historyList.querySelectorAll('.history-item');
  let visibleCount = 0;

  historyItems.forEach(item => {
    const sentiment = item.getAttribute('data-sentiment');
    const text = item.getAttribute('data-text'); // Already lowercased during creation for filtering
    const isOnBlockchain = item.getAttribute('data-blockchain') === 'true';

    let showItem = true;

    // Apply sentiment/blockchain filter
    if (filterValue !== 'all') {
      if (filterValue === 'blockchain') {
        if (!isOnBlockchain) showItem = false;
      } else { // Sentiment filter
        if (sentiment !== filterValue) showItem = false;
      }
    }

    // Apply search filter (only if showItem is still true)
    if (showItem && searchText && !text.includes(searchText)) {
      showItem = false;
    }

    // Show or hide the item
    item.style.display = showItem ? 'flex' : 'none';
    if (showItem) visibleCount++;
  });

   // Show empty state if no items are visible after filtering
   const emptyState = historyList.querySelector('.empty-state');
   if (emptyState) {
       emptyState.style.display = (visibleCount === 0 && analysisHistory.length > 0) ? 'flex' : 'none';
       if(visibleCount === 0 && analysisHistory.length > 0) {
            emptyState.querySelector('p').textContent = "No history items match your current filters.";
       } else if (analysisHistory.length === 0) {
           // Reset message if history is truly empty
           emptyState.querySelector('p').textContent = "No analysis history yet. Perform an analysis to see it here!";
           emptyState.style.display = 'flex'; // Ensure shown if history is truly empty
       }
   } else if (visibleCount === 0 && analysisHistory.length > 0) {
       // If empty state element was removed, maybe add it back temporarily? Or just log.
       console.log("No history items match filters, and empty state element not found.");
   }


  // console.log(`History filtered. Filter: ${filterValue}, Search: '${searchText}'. Visible items: ${visibleCount}`);
}


// Reanalyze text from history item index
function reanalyzeFromHistory(index) {
   // Convert index back to number if needed
   const itemIndex = parseInt(index, 10);
  if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= analysisHistory.length) {
      console.error("Invalid index for reanalysis:", index);
      return;
  }

  const item = analysisHistory[itemIndex];
  console.log("Reanalyzing from history item:", item);

  if (item && item.text) { // Check if item and text exist
    // Assuming item.text IS the full text for now based on previous logic
    const textToAnalyze = item.text;

    // Set text in the input field
    document.getElementById('textInput').value = textToAnalyze;

    // Set model selection
    document.getElementById('modelSelect').value = item.model || 'basic'; // Default to basic if model missing

     // Set keyword if it was used
     document.getElementById('keywordInput').value = item.keyword || '';

    // Clear URL input
    document.getElementById('urlInput').value = '';

    // Switch to the analyze tab
    const analyzeTabButton = document.querySelector('.tab-btn[data-tab="analyze"]');
    if (analyzeTabButton) analyzeTabButton.click();
    else { console.error("Analyze tab button not found."); return; }

    // Scroll to top might be helpful
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Perform analysis (simulate click or call function directly)
     // Use timeout to ensure tab switch UI updates before analysis starts
     setTimeout(() => {
        performAnalysis(); // Call analysis function directly
     }, 100);


  } else {
      console.error("Could not reanalyze history item - missing data:", item);
      alert("Could not retrieve data for reanalysis.");
  }
}


// --- Marketplace Management (Simulated) ---

// Populate marketplace tab UI
function populateMarketplaceTab() {
  const marketplaceList = document.getElementById('marketplaceItems');
  if (!marketplaceList) {
      console.error("Marketplace items container not found.");
      return;
  }

  marketplaceList.innerHTML = ''; // Clear current list

  // Use global `marketplaceItems` array from loadFromLocalStorage or demo generation
  if (!window.marketplaceItems || window.marketplaceItems.length === 0) {
      if (!localStorage.getItem('marketplaceItemsData')) { // Only generate if not even in storage
            // Generate demo items if empty (for demo purposes)
            window.marketplaceItems = []; // Reset if needed
            for (let i = 0; i < 8; i++) {
              const categories = ['Finance/Markets', 'Technology/AI', 'Blockchain/Crypto', 'Health/Medical', 'Environment/Policy', 'Product/Review', 'News/Politics', 'Business/Corporate'];
              const sentiments = ['Positive', 'Negative', 'Neutral'];
              const category = categories[Math.floor(Math.random() * categories.length)];
              const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
              const price = (Math.random() * 9 + 1.5).toFixed(2); // Price between 1.5 and 10.5
              const wordCount = 500 + Math.floor(Math.random() * 2500);

              window.marketplaceItems.push({
                id: 'demo-' + Date.now() + i, // More unique ID
                title: `${category} Sentiment Dataset #${i+1}`,
                description: `Anonymized sentiment data (${wordCount} words) related to ${category.split('/')[0]}. Sentiment focus: ${sentiment}.`, // Shorter description
                price: parseFloat(price),
                seller: `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`, // Random demo seller
                category: category.toLowerCase().split('/')[0], // Use first part of category for filtering tag
                sentiment: sentiment, // Main sentiment focus
                created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(), // Random creation date within last month
                isSold: Math.random() > 0.8 // 20% chance of being sold
              });
            }
            saveToLocalStorage(); // Save demo items if generated
            console.log("Generated and saved demo marketplace items.");
      } else {
           // If storage exists but array is empty (e.g., after parse error), show empty state
           marketplaceList.innerHTML = `<div class="empty-state"><i data-feather="shopping-cart"></i><p>Marketplace is currently empty.</p></div>`;
            if (typeof feather !== 'undefined') feather.replace();
            return; // Exit population
      }

  }

  // Populate with marketplace items
  window.marketplaceItems.forEach(item => {
    // Basic validation of item structure
    if (!item || !item.id || !item.title || !item.price || !item.category || !item.sentiment) {
        console.warn("Skipping invalid marketplace item:", item);
        return;
    }

    const itemElement = document.createElement('div');
    itemElement.className = `marketplace-item ${item.isSold ? 'sold' : ''}`;
    // Ensure category attribute is lowercase for consistent filtering
    itemElement.setAttribute('data-category', item.category.toLowerCase());
    itemElement.setAttribute('data-sentiment', item.sentiment.toLowerCase());

    const sentimentClass = item.sentiment.toLowerCase();

    itemElement.innerHTML = `
      <div class="marketplace-item-header">
        <span class="marketplace-category">${item.category}</span>
        <span class="marketplace-sentiment sentiment-${sentimentClass}">${item.sentiment}</span>
      </div>
      <div class="marketplace-item-content">
        <h3 class="marketplace-item-title">${item.title}</h3>
        <p class="marketplace-item-description">${item.description || 'No description available.'}</p>
      </div>
      <div class="marketplace-item-footer">
        <div class="marketplace-price">${item.price.toFixed(2)} L1X</div>
        <button class="marketplace-buy-btn" ${item.isSold ? 'disabled' : ''} onclick="purchaseMarketplaceItem('${item.id}', ${item.price})">
          ${item.isSold ? 'Sold' : 'Buy Now'}
        </button>
      </div>
    `;
    marketplaceList.appendChild(itemElement);
  });

   // Show empty state if needed (e.g., after filtering nothing matches)
   const emptyStateCheck = marketplaceList.querySelector('.empty-state');
   if (window.marketplaceItems.length === 0 && !emptyStateCheck) {
         marketplaceList.innerHTML = `<div class="empty-state"><i data-feather="shopping-cart"></i><p>Marketplace is currently empty.</p></div>`;
   } else if (emptyStateCheck && window.marketplaceItems.length > 0) {
       emptyStateCheck.remove(); // Remove empty state if items exist
   }


  // Apply default filter
  filterMarketplaceItems(document.querySelector('.category-btn.active')?.dataset.category || 'all');

  // Re-initialize Feather icons
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
}


// Filter marketplace items by category
function filterMarketplaceItems(category) {
  const marketplaceList = document.getElementById('marketplaceItems');
   if (!marketplaceList) return;

  const items = marketplaceList.querySelectorAll('.marketplace-item');
  let visibleCount = 0;
  const lowerCaseCategory = category.toLowerCase();
  console.log(`Filtering marketplace for category: ${lowerCaseCategory}`);

  items.forEach(item => {
    // Ensure data-category attribute exists before comparing
    const itemCategory = item.getAttribute('data-category');
    if (itemCategory) {
        if (lowerCaseCategory === 'all' || itemCategory === lowerCaseCategory) {
          item.style.display = 'flex'; // Use flex as items are flex columns
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
    } else {
        item.style.display = 'none'; // Hide items without a category attribute
    }
  });

   // Handle empty state after filtering
   let emptyState = marketplaceList.querySelector('.empty-state');
   if (visibleCount === 0 && window.marketplaceItems.length > 0) {
       if (!emptyState) { // Add empty state if it doesn't exist
            emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            marketplaceList.appendChild(emptyState);
       }
       emptyState.style.display = 'flex';
       emptyState.innerHTML = `<i data-feather="search"></i><p>No items found in the '${category}' category.</p>`;
       if (typeof feather !== 'undefined') feather.replace();
   } else if (emptyState) {
       emptyState.style.display = 'none'; // Hide empty state if items are visible or list is truly empty
   }
   // If marketplaceItems is empty, the initial population handles the empty state correctly.
}

// Simulate purchasing a marketplace item
function purchaseMarketplaceItem(itemId, price) {
  console.log(`Attempting to purchase item: ${itemId} for ${price} L1X`);
  if (typeof initiateBlockchainPurchase === 'function') {
    // Pass item ID and price to the blockchain function
    initiateBlockchainPurchase(itemId, price);
  } else {
    alert('Blockchain purchase functionality not available (placeholder).');
    console.error('initiateBlockchainPurchase function not found in blockchain.js.');
    // Simulate purchase success visually for demo
    const itemElement = document.querySelector(`.marketplace-item button[onclick*="'${itemId}'"]`).closest('.marketplace-item');
    if (itemElement && !itemElement.classList.contains('sold')) {
        itemElement.classList.add('sold');
        const button = itemElement.querySelector('.marketplace-buy-btn');
        button.textContent = 'Sold';
        button.disabled = true;
        // Update the item in the array (important for persistence)
        const itemIndex = window.marketplaceItems.findIndex(item => item.id === itemId);
        if(itemIndex !== -1) {
            window.marketplaceItems[itemIndex].isSold = true;
            saveToLocalStorage();
        }
    }

  }
}

// Open listing modal (Simplified using prompt)
function openListingModal() {
  if (!currentAnalysisResults) {
    alert('Please perform an analysis first before listing data.');
    return;
  }
   if (typeof isWalletConnected !== 'function' || !isWalletConnected()) {
       alert("Please connect your wallet to list data.");
       return;
   }

  // Basic prompt for price (replace with a proper modal UI later)
  const price = prompt(`Enter the price in L1X tokens for this analysis data:\n(Sentiment: ${currentAnalysisResults.results.sentiment}, Model: ${currentAnalysisResults.model})`, '5.00');
  const priceNum = parseFloat(price);

  if (price && !isNaN(priceNum) && priceNum > 0) {
    console.log(`Listing data for ${priceNum} L1X`);
    if (typeof createBlockchainListing === 'function') {
        // Pass analysis results and price to the listing function
        createBlockchainListing(currentAnalysisResults, priceNum);
    } else {
        alert('Blockchain listing functionality not available (placeholder).');
        console.error('createBlockchainListing function not found in blockchain.js.');
         // Simulate listing success for demo
         const category = currentAnalysisResults.results.key_topics?.[0]?.toLowerCase() || 'general';
         const newItem = {
             id: 'listed-' + Date.now(),
             title: `Listed: ${currentAnalysisResults.model} analysis`,
             description: `User-listed data snippet: ${currentAnalysisResults.text.substring(0,100)}...`,
             price: priceNum,
             seller: document.getElementById('connectWallet')?.textContent.split(':')[1]?.trim() || 'Your Wallet',
             category: category,
             sentiment: currentAnalysisResults.results.sentiment,
             created: new Date().toISOString(),
             isSold: false
         };
         window.marketplaceItems.unshift(newItem); // Add to beginning
         saveToLocalStorage();
         populateMarketplaceTab();
         alert(`Simulated listing successful for ${priceNum} L1X!`);
         // Switch to marketplace tab
         document.querySelector('.tab-btn[data-tab="marketplace"]')?.click();


    }
  } else if (price !== null) { // Only show error if prompt wasn't cancelled
      alert("Invalid price entered. Please enter a positive number.");
  }
}


// --- Chatbot Interaction Functions ---

// Send message from chat input to backend
async function sendChatMessage() {
    const messageInput = document.getElementById('chatbot-input');
    const userMessage = messageInput.value.trim();
    if (!userMessage) return;

    console.log("Sending chat message:", userMessage);
    appendChatMessage(userMessage, 'user'); // Display user message immediately
    messageInput.value = ''; // Clear input
    messageInput.focus();

    // --- CRUCIAL: Get context from the main application state ---
    let contextPayload = {};
    let hasContext = false; // Flag to track if context is available
    if (currentAnalysisResults && currentAnalysisResults.results && currentAnalysisResults.text) {
        contextPayload = {
            originalText: currentAnalysisResults.text, // The text snippet stored
            analysisResults: currentAnalysisResults.results // The full results object
        };
        console.log("Including analysis context in chat request.");
        hasContext = true;
    } else {
        console.log("No current analysis results found, sending chat message without context.");
    }

    // Show typing indicator
    const typingIndicator = appendChatMessage('...', 'bot', true); // isTyping = true

     // Only show "no context" message if context is missing *and* wasn't just shown
     const lastMessage = document.querySelector('#chatbot-messages .message:last-of-type');
     if (!hasContext && !lastMessage?.classList.contains('system-message')) {
        appendChatMessage("Note: I don't have any analysis results loaded. My answer will be general.", 'bot', false, true); // isSystem=true
     }


    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add authentication headers if needed later
            },
            body: JSON.stringify({
                message: userMessage,
                ...contextPayload // Spread the context data into the request body
            }),
        });

        // Remove typing indicator *before* processing response
         if (typingIndicator) removeTypingIndicator(typingIndicator);


        if (!response.ok) {
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg; // Use backend error message if available
            } catch (e) { /* Ignore if response body isn't JSON */ }
            throw new Error(errorMsg);
        }

        const data = await response.json();

        // Display bot response
        if(data.reply) {
            appendChatMessage(data.reply, 'bot');
        } else {
             throw new Error("Received empty reply from server.");
        }

    } catch (error) {
        console.error('Error sending/receiving chat message:', error);
         if (typingIndicator) removeTypingIndicator(typingIndicator); // Ensure removal on error
        appendChatMessage(`Sorry, I encountered an error processing your request. ${error.message}`, 'bot');
    }
}

// Append message to the chat widget UI
function appendChatMessage(text, sender, isTyping = false, isSystem = false) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) {
        console.error("Chat messages container not found!");
        return null;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('message'); // Base class

    // Add specific sender/type classes
    if (isSystem) {
        messageElement.classList.add('system-message', 'bot-message'); // Style like bot but maybe different later
        messageElement.style.fontStyle = 'italic';
        messageElement.style.opacity = '0.7';
        messageElement.textContent = text;
    } else {
         messageElement.classList.add(`${sender}-message`); // user-message or bot-message
         if (isTyping) {
            messageElement.classList.add('typing-indicator');
            messageElement.innerHTML = `<span>.</span><span>.</span><span>.</span>`; // Animated dots
         } else {
            // Basic markdown for newlines, bold, italics (for bot messages)
            if (sender === 'bot') {
                 let formattedText = text.replace(/</g, "<").replace(/>/g, ">"); // Basic HTML escaping first
                 formattedText = formattedText.replace(/\n/g, '<br>'); // Newlines
                 formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold **text**
                 formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italics *text*
                  // Add simple code block formatting for ```text```
                 formattedText = formattedText.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
                 // Add simple inline code formatting for `text`
                 formattedText = formattedText.replace(/`([^`]+)`/g, '<code>$1</code>');
                 messageElement.innerHTML = formattedText;
            } else {
                 messageElement.textContent = text; // Keep user text plain
            }
         }
    }


    messagesContainer.appendChild(messageElement);

    // Scroll to the bottom smoothly
    messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
    });

    return messageElement; // Return the element for potential removal (typing indicator)
}

// Remove typing indicator element
function removeTypingIndicator(indicatorElement) {
    if (indicatorElement && indicatorElement.parentNode) {
        indicatorElement.parentNode.removeChild(indicatorElement);
    } else {
        // Fallback if reference is lost
        const indicators = document.querySelectorAll('#chatbot-messages .typing-indicator');
        indicators.forEach(ind => ind.remove());
    }
}


// --- Local Storage ---
function saveToLocalStorage() {
  try {
    // Limit history size before saving
    const MAX_HISTORY_STORAGE = 30; // Store fewer items than displayed
    if (analysisHistory.length > MAX_HISTORY_STORAGE) {
        analysisHistory = analysisHistory.slice(0, MAX_HISTORY_STORAGE);
    }
    localStorage.setItem('sentimentHistoryData', JSON.stringify(analysisHistory));

    // Only save non-demo marketplace items
    const nonDemoMarketplaceItems = window.marketplaceItems.filter(item => !item.id.startsWith('demo-'));
     // Limit marketplace size too
     const MAX_MARKETPLACE_STORAGE = 50;
     if (nonDemoMarketplaceItems.length > MAX_MARKETPLACE_STORAGE) {
         // Keep the most recent non-demo items
         const nonDemoMarketplaceItems = nonDemoMarketplaceItems.slice(0, MAX_MARKETPLACE_STORAGE);
     }
    localStorage.setItem('marketplaceItemsData', JSON.stringify(nonDemoMarketplaceItems));

    // console.log("Data saved to localStorage.");
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    // Handle potential storage limit errors
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        alert("Browser storage limit reached. Older history/marketplace data may be lost.");
        // Consider more aggressive pruning or alternative storage if this happens often
    }
  }
}

function loadFromLocalStorage() {
  try {
    const historyData = localStorage.getItem('sentimentHistoryData');
    const marketplaceData = localStorage.getItem('marketplaceItemsData');

    if (historyData) {
      analysisHistory = JSON.parse(historyData);
      // Basic validation: ensure it's an array
      if(!Array.isArray(analysisHistory)) analysisHistory = [];
    } else {
        analysisHistory = [];
    }

    if (marketplaceData) {
      window.marketplaceItems = JSON.parse(marketplaceData);
       if(!Array.isArray(window.marketplaceItems)) window.marketplaceItems = [];
    } else {
        window.marketplaceItems = []; // Initialize if not found
    }
    console.log(`Loaded ${analysisHistory.length} history items and ${window.marketplaceItems.length} marketplace items from localStorage.`);
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    analysisHistory = []; // Reset on error
    window.marketplaceItems = [];
  }
}

// --- END OF script.js ---