import { OpenAIService } from '@/lib/services/openai';
import { SwapService } from '@/lib/services/swap';
import { MessageWithContext } from '@/types/chat/types';
import { ExpectedResponse } from '@/types/api';

export const runtime = "edge";

async function handlePost(request: Request ) {
  try {
    const body: MessageWithContext = await request.json();
    const { currentMessage, messageHistory, permissions } = body;

    // Format chat history
    const chatHistory = messageHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'system',
      content: msg.text
    } as const));

    // Get OpenAI response
    const openAIService = OpenAIService.getInstance();
    const completion = await openAIService.getResponse(currentMessage, chatHistory);
    const response = completion.choices[0].message;

    if (!response?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    const parsedResponse = JSON.parse(response.content) as ExpectedResponse;
    console.log(parsedResponse);

    // Handle different intents
    let responseData;
    switch (parsedResponse.intent) {
      case "SWAP":
        console.log("SWAP intent detected");
        responseData = await SwapService.executeSwap(permissions);
        break;

      case "GET_SWAP_RECEIPT":
        console.log("GET_SWAP_RECEIPT intent detected");
        if(!parsedResponse.purchaseId || !parsedResponse.amount) {
          throw new Error('Error occurred getting swap receipt');
        }
        responseData = await SwapService.getSwapReceipt(parsedResponse.purchaseId);
        break;

      case "NOT_SWAP":
        console.log("NOT_SWAP intent detected");
        responseData = {
          message: parsedResponse.responseText || "I'm sorry, I didn't understand that.",
          status: 'success'
        };
        break;

      default:
        throw new Error(`Unhandled intent: ${parsedResponse.intent}`);
    }

    // Create response using Response constructor
    const responseString = JSON.stringify(responseData)
    console.log({responseString});
    return new Response(responseString, {
      headers: {
        'content-type': 'application/json',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error occurred';
    
    // Create error response using Response constructor
    return new Response(
      JSON.stringify({ 
        status: 'error',
        message: 'Failed to process message',
        error: errorMessage
      }), 
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

export const POST = handlePost;