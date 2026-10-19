import Sidebar from "../../components/Sidebar";


export default async function register(){
    return(
        <div>
            <Sidebar/>
            <div>
            <h2>Register</h2>
            </div>
            <div>
                <form>
                    <label htmlFor="username">Username:</label>
                    <input type="text" id="username" name="username" />
                    <br />
                    <label htmlFor="email">Email:</label>
                    <input type="email" id="email" name="email" />
                    <br />
                    <label htmlFor="password">Password:</label>
                    <input type="password" id="password" name="password" />
                    <br />
                    <label htmlFor="confirm-password">Confirm Password:</label>
                    <input type="password" id="confirm-password" name="confirm-password" />
                    <button type="submit">Register</button>
                </form>
            </div>
        </div>
    )
}
