
const playButton = document.getElementById('play-pause');
const forwardButton = document.getElementById('next');
const backButton = document.getElementById('prev');

const songs = [
    'Zenith-Kavinsky.mp3',
    'Nightcall-Kavinsky.mp3',
    'HerosComeBack!!-nobodyknows.mp3',
];


//console.log('Play button element:', playButton);

// Select a random starting song
let song = Math.floor(Math.random() * songs.length); /*type: number */
// Select a random starting song
let songIndex = Math.floor(Math.random() * songs.length); /*type: int */
let user_clicked = false;

const track = new Audio(`./music/songs/${songs[songIndex]}`); 


// PLAY / PAUSE BUTTON
playButton.addEventListener('click', () => {

    if (user_clicked) {
        track.pause();
        user_clicked = false;
    } else {
        track.play();
        user_clicked = true;
    }

});


// FORWARD BUTTON
forwardButton.addEventListener('click', () => {

    // Move to the next song
    songIndex++;

    // If we're past the last song, return to the first
    if (songIndex >= songs.length) {
        songIndex = 0;
    }

    // Load and play the next song
    track.src = `./music/songs/${songs[songIndex]}`; 
    track.play();
    user_clicked = true;

});


// BACK BUTTON
backButton.addEventListener('click', () => {

    // Move to the previous song
    songIndex--;

    // If we're before the first song, go to the last
    if (songIndex < 0) {
        songIndex = songs.length - 1;
    }

    // Load and play the previous song
    track.src = `./music/songs/${songs[songIndex]}`;
    track.play();
    user_clicked = true;

});

