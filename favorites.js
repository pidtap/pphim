// favorites.js
document.addEventListener('DOMContentLoaded', () => {
    // Khởi tạo các UI dùng chung và truyền vào hàm xử lý tìm kiếm
    initializeSharedUI((query) => {
        if (query) window.location.href = `index.html?search_query=${encodeURIComponent(query)}`;
    });

    const favoritesGrid = document.getElementById('favorites-grid');
    const favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');

    if (favoritesGrid) {
        if (favorites.length > 0) {
            favoritesGrid.innerHTML = ''; // Xóa nội dung chờ (nếu có)
            favorites.forEach(movie => {
                // Dùng hàm createMovieCard từ shared.js
                const movieCard = createMovieCard(movie);
                favoritesGrid.appendChild(movieCard);
            });
        } else {
            favoritesGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Bạn chưa có phim yêu thích nào.</p>';
        }
    }
});