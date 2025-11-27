// Handle transition between scenes
window.addEventListener('mapAnimationComplete', () => {
    console.log('Transitioning to fence view...');
    
    // Fade out map
    if (mapboxScene) {
        mapboxScene.fadeOut();
    }
    
    // Fade in fence
    setTimeout(() => {
        fenceScene.show();
    }, 500);
});