// favorites.js
// Thay thế khối DOMContentLoaded trong favorites.js bằng mã này:
document.addEventListener('DOMContentLoaded', () => {
    // Hàm xử lý tìm kiếm mới: Luôn điều hướng đến trang search.html
    const universalSearchHandler = (query) => {
        if (query) {
            window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
    };
    initializeSharedUI(universalSearchHandler);

    const favoritesGrid = document.getElementById('favorites-grid');
    const favorites = JSON.parse(localStorage.getItem('favoriteMovies') || '[]');

    if (favoritesGrid) {
        if (favorites.length > 0) {
            favoritesGrid.innerHTML = ''; // Xóa nội dung chờ (nếu có)
            favorites.forEach(movie => {
                const movieCard = createMovieCard(movie);
                favoritesGrid.appendChild(movieCard);
            });
        } else {
            favoritesGrid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">Bạn chưa có phim yêu thích nào.</p>';
        }
    }
});