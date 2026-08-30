from pyapp.tests.test_api_handler import ApiHandlerLambdaTestCase


class TestSuccess(ApiHandlerLambdaTestCase):

    def test_unknown_path_returns_400(self):
        response = self.HANDLER.handle_request(dict(), dict())
        self.assertEqual(response.get('statusCode'), 400)

