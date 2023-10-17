import { MyLinks } from './components/MyLinks'
import { OutlineButton } from '../buttons/OutlineButton'

export const Heading = () => {
  return (
    <header className={"h-20 px-10 md:px-14 flex items-center justify-between sticky top-0 z-20 bg-background-dark bg-opacity-25 backdrop-blur-lg text-text-md font-bold"} id="header">
      <MyLinks />
      <OutlineButton onClick={() => window.open('/cv.pdf')}>
        My resume
      </OutlineButton>
    </header>
  )
}
