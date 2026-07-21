import React,{useState} from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import { PasswordInput, LoadingButton } from '../../../components/ui'

const Register = () => {

    const navigate = useNavigate()
    const [ username, setUsername ] = useState("")
    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")

    const {loading,handleRegister} = useAuth()
    
    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const data = await handleRegister({username, email, password})
            if (data && data.user) {
                navigate("/")
            }
        } catch (err) {
            // Error toasts are handled in useAuth hook
        }
    }

    return (
        <main>
            <div className="form-container">
                <h1>Register</h1>

                <form onSubmit={handleSubmit}>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            value={username}
                            onChange={(e) => { setUsername(e.target.value) }}
                            type="text" id="username" name='username' placeholder='Enter username' required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            value={email}
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' placeholder='Enter email address' required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <PasswordInput
                            value={password}
                            onChange={(e) => { setPassword(e.target.value) }}
                            id="password" name='password' placeholder='Enter password' required />
                    </div>

                    <LoadingButton 
                        type="submit"
                        loading={loading}
                        loadingText="Creating account..."
                        className="button primary-button"
                        id="registerSubmitBtn"
                    >
                        Register
                    </LoadingButton>

                </form>

                <p>Already have an account? <Link to={"/login"} >Login</Link> </p>
            </div>
        </main>
    )
}

export default Register