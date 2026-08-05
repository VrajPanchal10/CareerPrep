import { RouterProvider } from "react-router"
import { router } from "./app.routes.jsx"
import { AuthProvider } from "./features/auth/auth.context.jsx"
import { InterviewProvider } from "./features/interview/interview.context.jsx"
import { AtsProvider } from "./features/ats/ats.context.jsx"
import { ToastProvider } from "./context/ToastContext"


function App() {

  return (
    <>
      <ToastProvider>
        <AuthProvider>
          <InterviewProvider>
            <AtsProvider>
              <RouterProvider router={router} />
            </AtsProvider>
          </InterviewProvider>
        </AuthProvider>
      </ToastProvider>
    </>
  )
}

export default App