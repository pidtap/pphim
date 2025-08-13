// search.js

// Biến toàn cục cho trang tìm kiếm
let currentQuery = '';
let currentPage = 1;

// --- HÀM XỬ LÝ KẾT QUẢ VÀ PHÂN TRANG (Tái sử dụng từ main.js) ---

/** Hiển thị kết quả tìm kiếm và phân trang */
async function fetchAndShowSearchResults(query, page) {
    currentQuery = query;
    currentPage = page;
    const pageContent = document.getElementById("page-content");
    const gridContainer = document.getElementById("search-results-grid");
    const sectionTitle = document.getElementById("section-title");
    const paginationEl = document.getElementById("pagination");

    document.title = `Tìm kiếm: "${query}" - P Movie`;
    sectionTitle.innerHTML = `🔍 Kết quả cho: "<strong>${query}</strong>"`;
    gridContainer.innerHTML = `<div class="skeleton-grid">${'<div class="skeleton skeleton-card"></div>'.repeat(14)}</div>`;
    paginationEl.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const config = getCurrentApiConfig();
    const url = `${config.base}${config.paths.search(query, page)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        let movies = config.dataAccess.items(data) || [];
        const pagination = config.dataAccess.pagination(data);

        if (config.dataAccess.transform) {
            movies = movies.map(movie => config.dataAccess.transform(movie));
        }

        gridContainer.innerHTML = ''; // Xóa skeleton
        if (movies.length > 0) {
            movies.forEach(movie => gridContainer.appendChild(createMovieCard(movie)));
            
            let totalPages = pagination?.totalPages;
            if (!totalPages && pagination?.totalItems) {
                totalPages = Math.ceil(pagination.totalItems / 14);
            }
            if(config.id === 'nguonc') totalPages = undefined;
            
            paginationEl.classList.remove('hidden');
            renderPagination(page, totalPages);
        } else {
            gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">Không tìm thấy kết quả nào cho "${query}".</p>`;
            paginationEl.classList.add('hidden');
        }
    } catch (err) {
        gridContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center;">Lỗi khi tải kết quả. Vui lòng thử lại.</p>`;
        console.error(err);
    }
}

/** Hiển thị các nút phân trang */
function renderPagination(currentPage, totalPages) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer || !totalPages || totalPages <= 1) {
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    let pageItems = [];
    const maxPagesToShow = 5;
    const halfPages = Math.floor(maxPagesToShow / 2);

    pageItems.push(`<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`);

    if (totalPages <= maxPagesToShow + 2) {
        for (let i = 1; i <= totalPages; i++) {
            pageItems.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
        }
    } else {
        let startPage = Math.max(2, currentPage - halfPages);
        let endPage = Math.min(totalPages - 1, currentPage + halfPages);

        if (currentPage - 1 <= halfPages) endPage = maxPagesToShow;
        if (totalPages - currentPage <= halfPages) startPage = totalPages - maxPagesToShow + 1;

        pageItems.push(`<button class="page-btn ${1 === currentPage ? 'active' : ''}" onclick="goToPage(1)">1</button>`);
        if (startPage > 2) pageItems.push(`<span class="page-ellipsis">...</span>`);
        for (let i = startPage; i <= endPage; i++) {
            pageItems.push(`<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`);
        }
        if (endPage < totalPages - 1) pageItems.push(`<span class="page-ellipsis">...</span>`);
        pageItems.push(`<button class="page-btn ${totalPages === currentPage ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>`);
    }

    pageItems.push(`<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`);
    paginationContainer.innerHTML = pageItems.join('');
}

/** Chuyển đến trang kết quả mới */
function goToPage(page) {
    if (page < 1) return;
    // Cập nhật URL và tải lại kết quả mà không cần tải lại toàn bộ trang
    const url = new URL(window.location);
    url.searchParams.set('page', page);
    window.history.pushState({}, '', url);
    fetchAndShowSearchResults(currentQuery, page);
}


// --- KHỞI CHẠY KHI TẢI TRANG ---

document.addEventListener('DOMContentLoaded', () => {
    // Hàm xử lý tìm kiếm mới: luôn điều hướng đến trang search.html
    const universalSearchHandler = (query) => {
        if (query) {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    };
    initializeSharedUI(universalSearchHandler);

    // Lấy thông tin từ URL
    const urlParams = new URLSearchParams(window.location.search);
    const queryFromUrl = urlParams.get('q');
    const pageFromUrl = parseInt(urlParams.get('page')) || 1;

    if (queryFromUrl) {
        document.getElementById('search-input').value = queryFromUrl;
        fetchAndShowSearchResults(queryFromUrl, pageFromUrl);
    } else {
        document.getElementById('section-title').textContent = 'Vui lòng nhập từ khóa để tìm kiếm.';
        document.getElementById('search-results-grid').innerHTML = '';
    }
});