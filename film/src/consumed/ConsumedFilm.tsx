import { createFilm } from '../components/Film';
import { SCENES } from './script';
import { BookScene, DareScene, FriendsScene, HowScene, IntroScene, MealScene, OutroScene, ShareScene, SongScene, TodayScene, TonightScene, WelcomeScene } from './scenes';

export const consumedFilm = createFilm('consumed', SCENES, {
  intro: IntroScene,
  welcome: WelcomeScene,
  friends: FriendsScene,
  song: SongScene,
  book: BookScene,
  meal: MealScene,
  dare: DareScene,
  today: TodayScene,
  tonight: TonightScene,
  share: ShareScene,
  how: HowScene,
  outro: OutroScene,
});
