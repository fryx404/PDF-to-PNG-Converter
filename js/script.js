let generatedImages = []; // To store image data for zipping

window.onload = function() {
    // Set worker for pdf.js from a stable CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    const pdfFileInput = document.getElementById('pdf-file');
    const fileNameDisplay = document.getElementById('file-name');
    const loader = document.getElementById('loader');
    const imageContainer = document.getElementById('image-container');
    const errorBox = document.getElementById('error-box');
    const errorMessage = document.getElementById('error-message');
    const zipContainer = document.getElementById('zip-download-container');
    const zipBtn = document.getElementById('download-zip-btn');

    pdfFileInput.addEventListener('change', handleFileSelect);
    zipBtn.addEventListener('click', downloadAllAsZip);

    /**
     * Handles the file selection event.
     */
    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            showError('PDFファイルを選択してください。');
            resetUI();
            return;
        }
        
        resetUI();
        fileNameDisplay.textContent = `選択中のファイル: ${file.name}`;
        loader.classList.remove('hidden');
        
        try {
            const pdfData = await readFileAsArrayBuffer(file);
            await renderPdfToPng(pdfData);
        } catch (error) {
            console.error('Error processing PDF:', error);
            showError('PDFの処理中にエラーが発生しました。ファイルが破損している可能性があります。');
        } finally {
            loader.classList.add('hidden');
        }
    }

    /**
     * Reads a file as an ArrayBuffer.
     */
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Renders each page of a PDF as a PNG image.
     */
    async function renderPdfToPng(pdfData) {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const scale = 2.0;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: context, viewport: viewport };
            await page.render(renderContext).promise;
            
            const dataUrl = canvas.toDataURL('image/png');
            const fileName = getFormattedFileName(i);
            generatedImages.push({ name: fileName, dataUrl: dataUrl });
            createImageCard(dataUrl, i, fileName);
        }

        if (generatedImages.length > 0) {
            zipContainer.classList.remove('hidden');
        }
    }
    
    /**
     * Formats the page number into a 4-digit string.
     */
    function getFormattedFileName(pageNum) {
        const paddedNum = String(pageNum).padStart(4, '0');
        return `page_${paddedNum}.png`;
    }

    /**
     * Creates and appends an image card to the container.
     */
    function createImageCard(dataUrl, pageNum, fileName) {
        const card = document.createElement('div');
        card.className = 'preview-card bg-white rounded-lg shadow-md border border-gray-200 flex flex-col';

        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = `Page ${pageNum}`;
        img.className = 'w-full h-auto object-contain rounded-t-lg bg-gray-100 flex-grow';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'p-4 text-center';
        
        const pageLabel = document.createElement('p');
        pageLabel.textContent = `ページ ${pageNum}`;
        pageLabel.className = 'font-semibold text-gray-700 mb-3';

        const downloadLink = document.createElement('a');
        downloadLink.href = dataUrl;
        downloadLink.download = fileName;
        downloadLink.textContent = 'ダウンロード';
        downloadLink.className = 'inline-block w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600 transition-colors';

        infoDiv.appendChild(pageLabel);
        infoDiv.appendChild(downloadLink);
        card.appendChild(img);
        card.appendChild(infoDiv);

        imageContainer.appendChild(card);
    }

    /**
     * Creates a ZIP file from generated images and triggers download.
     */
    async function downloadAllAsZip() {
        if (generatedImages.length === 0) return;

        zipBtn.textContent = 'ZIPファイルを圧縮中...';
        zipBtn.disabled = true;

        try {
            const zip = new JSZip();
            
            const imagePromises = generatedImages.map(async (img) => {
                const response = await fetch(img.dataUrl);
                const blob = await response.blob();
                zip.file(img.name, blob);
            });
            
            await Promise.all(imagePromises);

            const zipBlob = await zip.generateAsync({ type: 'blob', compression: "DEFLATE" });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            const pdfFile = pdfFileInput.files[0];
            const zipFileName = pdfFile ? `${pdfFile.name.replace(/\.pdf$/i, '')}.zip` : 'images.zip';
            link.download = zipFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Error creating ZIP file:", error);
            showError("ZIPファイルの作成中にエラーが発生しました。");
        } finally {
            zipBtn.textContent = 'すべてをZIPでダウンロード';
            zipBtn.disabled = false;
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorBox.classList.remove('hidden');
    }

    function hideError() {
        errorBox.classList.add('hidden');
    }

    function resetUI() {
        pdfFileInput.value = '';
        fileNameDisplay.textContent = 'まだファイルが選択されていません。';
        imageContainer.innerHTML = '';
        generatedImages = [];
        zipContainer.classList.add('hidden');
        hideError();
    }
} 