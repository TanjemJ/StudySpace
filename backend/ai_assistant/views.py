from rest_framework import generics, status, permissions, views
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
from .models import AIConversation
from .serializers import AIConversationSerializer, AIMessageSerializer

SYSTEM_PROMPT = """You are StudySpace AI Academic Assistant. You help university students with academic questions.

CRITICAL RULES:
1. NEVER give direct answers to assignments, essays, or coursework questions.
2. Instead, guide students step-by-step through the thinking process.
3. Ask follow-up questions to help them arrive at the answer themselves.
4. Use the Socratic method: respond with guiding questions and hints.
5. If a student asks you to write an essay/assignment, explain that you cannot do this but offer to help them plan and structure their work.
6. Be encouraging, supportive, and patient.
7. You can explain concepts, provide examples, and clarify misunderstandings.
8. For career advice, CV help, and study tips, you can be more direct.
"""

class ConversationListView(generics.ListCreateAPIView):
    serializer_class = AIConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return AIConversation.objects.filter(user=self.request.user)
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ConversationDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = AIConversationSerializer
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return AIConversation.objects.filter(user=self.request.user)

class SendMessageView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AIMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        conv_id = data.get("conversation_id")
        if conv_id:
            try:
                conv = AIConversation.objects.get(id=conv_id, user=request.user)
            except AIConversation.DoesNotExist:
                return Response({"error": "Conversation not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            conv = AIConversation.objects.create(
                user=request.user,
                title=data["message"][:50] + "..." if len(data["message"]) > 50 else data["message"],
            )

        # Add user message
        conv.messages.append({
            "role": "user",
            "content": data["message"],
            "timestamp": timezone.now().isoformat(),
        })

        # Call Gemini API (or mock if no key)
        ai_response = self._get_ai_response(conv.messages)

        conv.messages.append({
            "role": "assistant",
            "content": ai_response,
            "timestamp": timezone.now().isoformat(),
        })
        conv.save()

        return Response({
            "conversation": AIConversationSerializer(conv).data,
            "response": ai_response,
        })

    def _get_ai_response(self, messages):
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            # Mock response for development
            last_msg = messages[-1]["content"] if messages else ""
            return (
                "That is a great question! Let me help you think through this.\n\n"
                "Before I guide you, could you tell me:\n"
                "1. What do you already know about this topic?\n"
                "2. What specific part are you finding challenging?\n"
                "3. Have you looked at any course materials related to this?\n\n"
                "This will help me provide the most useful guidance for you."
            )

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash-lite")

            history = [{"role": "user", "parts": [SYSTEM_PROMPT]}]
            for msg in messages:
                role = "user" if msg["role"] == "user" else "model"
                history.append({"role": role, "parts": [msg["content"]]})

            response = model.generate_content(history)
            return response.text
        except Exception as e:
            return f"I am having trouble connecting right now. Please try again in a moment. (Error: {str(e)})"
