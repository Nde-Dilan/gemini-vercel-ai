import { ExternalLink } from '@/components/external-link'

export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-zinc-50 sm:p-8 p-4 text-sm sm:text-base">
        <h1 className="text-2xl sm:text-3xl tracking-tight font-semibold max-w-fit inline-block">
          CarePulse: AI Traditional Medicine Advisor
        </h1>
        <p className="leading-normal text-zinc-900">
          This is an AI-powered chatbot trained to provide immediate, culturally
          relevant health advice based on traditional Cameroonian medicine
          practices. It&apos;s designed to bridge the gap between traditional
          wisdom and modern healthcare accessibility.
        </p>
        <p className="leading-normal text-zinc-900">
          It&apos;s like having a <b>Wise village elder</b> and a modern doctor
          in your pocket– we&apos;re the{' '}
          <ExternalLink href={'https://wa.me/237694525931/'}>
            WhatsApp
          </ExternalLink>{' '}
          meets{' '}
          <ExternalLink href={'https://www.webmd.com/'}>WebMD</ExternalLink>
          for African traditional medicine.
        </p>
      </div>
    </div>
  )
}
