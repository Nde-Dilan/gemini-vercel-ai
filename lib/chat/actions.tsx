// @ts-nocheck

/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @next/next/no-img-element */
import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  createStreamableValue
} from 'ai/rsc'

import { BotCard, BotMessage } from '@/components/stocks'

import { nanoid, sleep } from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat } from '../types'
import { auth } from '@/auth'
import { FlightStatus } from '@/components/flights/flight-status'
import { SelectSeats } from '@/components/flights/select-seats'
import { ListFlights } from '@/components/flights/list-flights'
import { BoardingPass } from '@/components/flights/boarding-pass'
import { PurchaseTickets } from '@/components/flights/purchase-ticket'
import { CheckIcon, SpinnerIcon } from '@/components/ui/icons'
import { format } from 'date-fns'
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { ListHotels } from '@/components/hotels/list-hotels'
import { Destinations } from '@/components/flights/destinations'
import { Video } from '@/components/media/video'
import { rateLimit } from './ratelimit'

const AIResponse = ({ text }) => (
  <div>
    <h3>AI Analysis:</h3>
    <p style={{ whiteSpace: 'pre-wrap' }}><BotMessage content={text}/></p>
  </div>
)
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''
)

async function describeImage(imageBase64: string) {
  'use server'

  await rateLimit()

  const aiState = getMutableAIState()
  const spinnerStream = createStreamableUI(null)
  const messageStream = createStreamableUI(null)
  const uiStream = createStreamableUI()

  uiStream.update(
    <UserMessage showAvatar>
      {' '}
      <img
        src={imageBase64}
        alt="User uploaded image"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </UserMessage>
  )
  
  ;(async () => {
    try {
      let text = ''

      // attachment as video for demo purposes,
      // add your implementation here to support
      // video as input for prompts.
      if (imageBase64 === '') {
        await new Promise(resolve => setTimeout(resolve, 5000))

        text = `
      `
      } else {
        const imageData = imageBase64.split(',')[1]

        const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' })
        const prompt = `Please analyze the provided image carefully and identify any medicinal plants present. For each plant you can confidently recognize:

Identification:

Provide the common name in both English and local Cameroonian languages (if known).
State the full scientific name (genus and species).
If the plant is only identifiable to genus level, clearly state this.


Visual Characteristics:

Describe the overall plant structure (herb, shrub, tree, vine, etc.).
Detail the leaf characteristics: shape, arrangement, margin, venation, and texture.
If visible, describe the flowers: color, shape, arrangement, and number of petals.
Note any visible fruits, seeds, or bark features.
Mention any unique identifiers like thorns, hairs, or distinctive coloration.


Traditional Medicinal Uses:

List specific traditional uses in Cameroonian medicine.
Mention which plant parts are typically used (leaves, roots, bark, etc.).
If known, briefly describe traditional preparation methods.
Note any variations in use across different Cameroonian regions or ethnic groups.


Distinguishing Features:

Highlight key features that differentiate this plant from similar species.
Mention any common look-alikes and how to distinguish between them.


Confidence Level:

Clearly state your level of confidence in the identification (e.g., highly confident, moderately confident, unsure).
If unsure, list potential alternative identifications and explain why there's uncertainty.


Toxicity and Handling:

Clearly highlight any known toxicity or potential for adverse reactions.
Provide specific handling precautions if the plant is known to be irritant or toxic.


Habitat and Distribution:

Briefly mention the typical habitat and distribution of the plant in Cameroon.


If Unable to Identify:

Provide a detailed description of what you see in the image.
Focus on leaf shape, arrangement, and texture.
Describe any visible flowers or fruits in detail.
Note overall plant structure and growth habit.
Mention any distinctive features like stem color, presence of hairs, etc.
Estimate the size of the plant or its parts if possible.


Image Quality Assessment:

Comment on the quality and clarity of the image.
Note any parts of the plant that are not clearly visible or out of focus.
Suggest additional views or close-ups that would aid in more accurate identification.


Seasonal Considerations:

If relevant, mention how the plant's appearance might change seasonally.


Cultural Significance:

If known, briefly mention any cultural or spiritual significance of the plant in Cameroonian traditions.



Important Disclaimers:

Emphasize that this identification is based solely on visual assessment of the provided image and should not be considered definitive without expert verification.
Stress that any medicinal use should only be under the guidance of qualified traditional healers or healthcare professionals.
Remind that some plants may have both medicinal and toxic properties depending on preparation and dosage.

Please provide this detailed analysis for each identifiable plant in the image. If multiple plants are present, clearly separate the information for each.`
        const image = {
          inlineData: {
            data: imageData,
            mimeType: 'image/png'
          }
        }

        const result = await model.generateContent([prompt, image])
        text = result.response.text()
        console.log('Results: ', text)
      }

      spinnerStream.done(null)
      messageStream.done(null)

      uiStream.done(
        <BotCard>
          <img
            src={imageBase64}
            alt="User uploaded image"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          <AIResponse text={text} />
        </BotCard>
      )
      //TODO: Find the AIResponse component and replace the one that i
      aiState.done({
        ...aiState.get(),
        interactions: [text]
      })
    } catch (e) {
      console.error(e)

      const error = new Error(
        'The AI got rate limited, please try again later.'
      )
      uiStream.error(error)
      spinnerStream.error(error)
      messageStream.error(error)
      aiState.done()
    }
  })()

  return {
    id: nanoid(),
    attachments: uiStream.value,
    spinner: spinnerStream.value,
    display: messageStream.value
  }
}

async function submitUserMessage(content: string) {
  'use server'

  await rateLimit()

  const aiState = getMutableAIState()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: `${aiState.get().interactions.join('\n\n')}\n\n${content}`
      }
    ]
  })

  const history = aiState.get().messages.map(message => ({
    role: message.role,
    content: message.content
  }))
  // console.log(history)

  const textStream = createStreamableValue('')
  const spinnerStream = createStreamableUI(<SpinnerMessage />)
  const messageStream = createStreamableUI(null)
  const uiStream = createStreamableUI()

  ;(async () => {
    try {
      const result = await streamText({
        model: google('models/gemini-1.5-flash'),
        temperature: 0,
        system: `\

You are a friendly AI assistant trained in traditional Cameroonian medicine. Your role is to provide information and guidance based on well-documented traditional practices, while prioritizing user safety and ethical considerations. 

The date today is ${format(new Date(), 'd LLLL, yyyy')}. 
The user's current location is Yaoundé, Cameroon. Tailor your advice to locally available herbs and remedies commonly used in this region.

Key Guidelines:

1. Accuracy and Sources:
   - Only provide information on traditional remedies that are well-documented in reputable sources on Cameroonian traditional medicine.
   - Clearly state the source of your information when possible (e.g., specific texts, studies, or recognized traditional healers).
   - Do not invent or speculate about remedies or practices.
   - If you're unsure about any information, clearly state this and advise seeking guidance from a qualified traditional healer.

2. Safety First:
   - Emphasize that your advice is for informational purposes only and does not replace professional medical diagnosis or treatment.
   - Clearly state any known risks or side effects associated with suggested remedies.
   - Provide clear warnings about remedies that may interact with medications or be unsuitable for certain conditions (e.g., pregnancy, chronic illnesses).

3. Cultural Sensitivity:
   - Respect and acknowledge the cultural significance of traditional practices.
   - Use local names for plants and remedies alongside scientific names when available.

4. Limitations:
   - Clearly state the limitations of traditional remedies and when modern medical intervention is necessary.
   - Do not make claims about treating or curing serious illnesses.

5. Ethical Considerations:
   - Do not recommend remedies that involve endangered species or illegal substances.
   - Respect intellectual property rights related to traditional knowledge.

Here's the expanded flow:

1. Inquire about the user's symptoms or health concern:
   - Ask specific questions to understand the nature, duration, and severity of symptoms.
   - Inquire about any existing medical conditions or medications.

2. Provide information on relevant traditional remedies:
   - Offer 2-3 well-documented traditional remedies specific to the symptoms.
   - Clearly state the traditional uses of each remedy.
   - Mention any scientific studies supporting or refuting these uses, if available.

3. Explain how to prepare and use the remedy safely:
   - Provide step-by-step instructions for preparation.
   - Specify exact measurements and dosages.
   - Explain proper storage methods and shelf life of prepared remedies.
   - Clearly state any restrictions (e.g., not for internal use, avoid during pregnancy).

4. Offer advice on lifestyle changes or preventive measures:
   - Suggest relevant dietary modifications based on traditional Cameroonian practices.
   - Recommend appropriate physical activities or rest, as traditionally advised.
   - Mention any traditionally recognized triggers to avoid.

5. Recommend when to seek professional medical help:
   - Provide clear guidelines on symptoms that require immediate medical attention.
   - Advise on how long to try traditional remedies before seeking professional help.
   - Emphasize the importance of informing healthcare providers about any traditional remedies used.

6. Provide information on nearby traditional healers or clinics:
   - Offer information on reputable, registered traditional healers in Yaoundé.
   - Include details on local clinics that integrate traditional and modern medicine.
   - Advise on questions to ask when consulting a traditional healer.

7. Follow up on the effectiveness of the suggested remedies:
   - Encourage the user to monitor their symptoms and note any changes.
   - Advise on signs of improvement to look for.
   - Provide guidance on when to discontinue the remedy or seek further advice.

8. Feedback and Continuous Improvement:
   - Encourage users to provide feedback on the effectiveness of suggested remedies.
   - Use this feedback to refine and improve future recommendations.

9. Data Privacy and Security:
   - Remind users not to share personal medical information in public forums.
   - Advise consulting with healthcare providers for personalized medical advice.

Remember: Always emphasize that this information is based on traditional practices and should not be considered a substitute for professional medical advice, diagnosis, or treatment. Encourage users to consult with qualified healthcare providers for any serious or persistent health concerns.
      `,
        messages: [...history]
      })

      let textContent = ''
      spinnerStream.done(null)

      for await (const delta of result.fullStream) {
        const { type } = delta

        if (type === 'text-delta') {
          const { textDelta } = delta

          textContent += textDelta
          messageStream.update(<BotMessage content={textContent} />)

          aiState.update({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: textContent
              }
            ]
          })
        }
      }

      uiStream.done()
      textStream.done()
      messageStream.done()
    } catch (e) {
      console.error(e)

      const error = new Error(
        'The AI got rate limited, please try again later.'
      )
      uiStream.error(error)
      textStream.error(error)
      messageStream.error(error)
      aiState.done()
    }
  })()

  return {
    id: nanoid(),
    attachments: uiStream.value,
    spinner: spinnerStream.value,
    display: messageStream.value
  }
}

export async function requestCode() {
  'use server'

  const aiState = getMutableAIState()

  aiState.done({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        role: 'assistant',
        content:
          "A code has been sent to user's phone. They should enter it in the user interface to continue."
      }
    ]
  })

  const ui = createStreamableUI(
    <div className="animate-spin">
      <SpinnerIcon />
    </div>
  )

  ;(async () => {
    await sleep(2000)
    ui.done()
  })()

  return {
    status: 'requires_code',
    display: ui.value
  }
}

export async function validateCode() {
  'use server'

  const aiState = getMutableAIState()

  const status = createStreamableValue('in_progress')
  const ui = createStreamableUI(
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-zinc-500">
      <div className="animate-spin">
        <SpinnerIcon />
      </div>
      <div className="text-sm text-zinc-500">
        Please wait while we fulfill your order.
      </div>
    </div>
  )

  ;(async () => {
    await sleep(2000)

    ui.done(
      <div className="flex flex-col items-center text-center justify-center gap-3 p-4 text-emerald-700">
        <CheckIcon />
        <div>Payment Succeeded</div>
        <div className="text-sm text-zinc-600">
          Thanks for your purchase! You will receive an email confirmation
          shortly.
        </div>
      </div>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages.slice(0, -1),
        {
          role: 'assistant',
          content: 'The purchase has completed successfully.'
        }
      ]
    })

    status.done('completed')
  })()

  return {
    status: status.value,
    display: ui.value
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id?: string
  name?: string
  display?: {
    name: string
    props: Record<string, any>
  }
}

export type AIState = {
  chatId: string
  interactions?: string[]
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
  spinner?: React.ReactNode
  attachments?: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    requestCode,
    validateCode,
    describeImage
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), interactions: [], messages: [] },
  unstable_onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  unstable_onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'assistant' ? (
          <BotMessage content={message.content} />
        ) : message.role === 'user' ? (
          message.display?.name === 'userImage' ? (
            <BotCard>
              <img
                src={message.display.props.imageBase64}
                alt="User uploaded image"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </BotCard>
          ) : (
            <UserMessage showAvatar>{message.content}</UserMessage>
          )
        ) : (
          <BotMessage content={message.content} />
        )
    }))
}
